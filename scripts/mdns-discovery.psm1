function Read-DnsUInt16([byte[]]$Packet, [int]$Offset) {
    if ($Offset -lt 0 -or $Offset + 2 -gt $Packet.Length) {
        throw [System.FormatException]::new('Truncated DNS integer.')
    }

    $value = ([int]$Packet[$Offset] -shl 8) -bor $Packet[$Offset + 1]
    return $value
}

function Read-DnsName([byte[]]$Packet, [int]$Offset) {
    $labels = [System.Collections.Generic.List[string]]::new()
    $visited = [System.Collections.Generic.HashSet[int]]::new()
    $position = $Offset
    $nextOffset = $null
    while ($true) {
        if ($position -lt 0 -or $position -ge $Packet.Length -or -not $visited.Add($position)) {
            throw [System.FormatException]::new('Invalid DNS name pointer.')
        }

        $length = $Packet[$position]
        if (($length -band 192) -eq 192) {
            $pointer = Read-DnsUInt16 $Packet $position
            $nextOffset ??= $position + 2
            $position = $pointer -band 16383
            continue
        }

        $position++
        if ($length -eq 0) {
            $nextOffset ??= $position
            break
        }

        if ($length -gt 63 -or $position + $length -gt $Packet.Length) {
            throw [System.FormatException]::new('Invalid DNS label length.')
        }

        $labels.Add([System.Text.Encoding]::UTF8.GetString($Packet, $position, $length))
        $position += $length
    }

    $name = $labels -join '.'
    if ($name.Length -gt 253) {
        throw [System.FormatException]::new('DNS name is too long.')
    }

    return [pscustomobject]@{ Name = $name; NextOffset = $nextOffset }
}

function New-MdnsQuery([string]$Name, [int]$RecordType) {
    $query = [System.Collections.Generic.List[byte]]::new()
    $query.AddRange([byte[]]@(0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0))
    foreach ($label in $Name.Split('.')) {
        $labelBytes = [System.Text.Encoding]::UTF8.GetBytes($label)
        if ($labelBytes.Length -eq 0 -or $labelBytes.Length -gt 63) {
            throw [System.FormatException]::new('Invalid DNS query label.')
        }

        $query.Add([byte]$labelBytes.Length)
        $query.AddRange($labelBytes)
    }

    $query.AddRange([byte[]]@(0, ($RecordType -shr 8), ($RecordType -band 255), 128, 1))
    return ,$query.ToArray()
}

function Read-MdnsRecords([byte[]]$Packet) {
    if ($Packet.Length -lt 12) {
        throw [System.FormatException]::new('Truncated DNS header.')
    }

    $flags = Read-DnsUInt16 $Packet 2
    if (($flags -band 32768) -eq 0 -or ($flags -band 30720) -ne 0 -or ($flags -band 15) -ne 0) {
        return
    }

    $questionCount = Read-DnsUInt16 $Packet 4
    $recordCount = (Read-DnsUInt16 $Packet 6) + (Read-DnsUInt16 $Packet 8) + (Read-DnsUInt16 $Packet 10)
    $offset = 12
    for ($question = 0; $question -lt $questionCount; $question++) {
        $name = Read-DnsName $Packet $offset
        $offset = $name.NextOffset + 4
        if ($offset -gt $Packet.Length) {
            throw [System.FormatException]::new('Truncated DNS question.')
        }
    }

    for ($record = 0; $record -lt $recordCount; $record++) {
        $name = Read-DnsName $Packet $offset
        $offset = $name.NextOffset
        if ($offset + 10 -gt $Packet.Length) {
            throw [System.FormatException]::new('Truncated DNS record.')
        }

        $recordType = Read-DnsUInt16 $Packet $offset
        $recordClass = Read-DnsUInt16 $Packet ($offset + 2)
        $isExpired = ($Packet[$offset + 4] -bor $Packet[$offset + 5] -bor $Packet[$offset + 6] -bor $Packet[$offset + 7]) -eq 0
        $dataLength = Read-DnsUInt16 $Packet ($offset + 8)
        $dataOffset = $offset + 10
        $offset = $dataOffset + $dataLength
        if ($offset -gt $Packet.Length) {
            throw [System.FormatException]::new('Truncated DNS record data.')
        }

        if ($isExpired -or ($recordClass -band 32767) -ne 1) {
            continue
        }

        if ($recordType -eq 33 -and $dataLength -ge 7) {
            $port = Read-DnsUInt16 $Packet ($dataOffset + 4)
            $target = Read-DnsName $Packet ($dataOffset + 6)
            if ($target.NextOffset -gt $offset) {
                throw [System.FormatException]::new('Invalid DNS service target.')
            }

            if ($port -gt 0 -and $target.Name -ne '') {
                [pscustomobject]@{ Kind = 'Service'; Name = $name.Name; Target = $target.Name; Port = $port }
            }
        } elseif ($recordType -eq 1 -and $dataLength -eq 4) {
            $address = [System.Net.IPAddress]::new([byte[]]$Packet[$dataOffset..($offset - 1)])
            [pscustomobject]@{ Kind = 'Address'; Name = $name.Name; Address = $address.IPAddressToString }
        }
    }
}

function Find-NetworkMdnsServices([string]$ServiceType) {
    $serviceName = "$ServiceType.local"
    $query = New-MdnsQuery $serviceName 12
    $destination = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse('224.0.0.251'), 5353)
    $clients = [System.Collections.Generic.List[System.Net.Sockets.UdpClient]]::new()
    $destinations = @{}
    $services = @{}
    $hostAddresses = @{}
    $queriedHosts = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    try {
        foreach ($localAddress in Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction Stop) {
            if ($localAddress.IPAddress -like '127.*' -or $localAddress.IPAddress -like '169.254.*') {
                continue
            }

            $client = [System.Net.Sockets.UdpClient]::new([System.Net.Sockets.AddressFamily]::InterNetwork)
            $clients.Add($client)
            try {
                $interfaceAddress = [System.Net.IPAddress]::Parse($localAddress.IPAddress)
                $client.Client.Bind([System.Net.IPEndPoint]::new($interfaceAddress, 0))
                $client.Client.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::IP, [System.Net.Sockets.SocketOptionName]::MulticastInterface, $interfaceAddress.GetAddressBytes())
                $client.Client.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::IP, [System.Net.Sockets.SocketOptionName]::MulticastTimeToLive, 255)
                $targets = [System.Collections.Generic.List[System.Net.IPEndPoint]]::new()
                $targets.Add($destination)
                foreach ($neighbor in Get-NetNeighbor -InterfaceIndex $localAddress.InterfaceIndex -AddressFamily IPv4 -ErrorAction Stop) {
                    if ($neighbor.LinkLayerAddress -in @('', '00-00-00-00-00-00', 'FF-FF-FF-FF-FF-FF')) {
                        continue
                    }

                    $neighborAddress = [System.Net.IPAddress]::Parse($neighbor.IPAddress)
                    if ($neighborAddress.GetAddressBytes()[0] -ge 224) {
                        continue
                    }

                    $targets.Add([System.Net.IPEndPoint]::new($neighborAddress, 5353))
                }

                $destinations[$client] = $targets
                foreach ($target in $targets) {
                    $client.Send($query, $query.Length, $target) | Out-Null
                }
            } catch [System.Net.Sockets.SocketException] {
                Write-Verbose "mDNS query could not use $($localAddress.IPAddress): $($_.Exception.Message)"
                $client.Dispose()
                $clients.Remove($client) | Out-Null
            }
        }

        $discoveryTime = [System.Diagnostics.Stopwatch]::StartNew()
        $nextQuerySeconds = 1
        while ($clients.Count -gt 0 -and $discoveryTime.Elapsed.TotalSeconds -lt 3) {
            if ($discoveryTime.Elapsed.TotalSeconds -ge $nextQuerySeconds) {
                foreach ($client in $clients) {
                    try {
                        foreach ($destination in $destinations[$client]) {
                            $client.Send($query, $query.Length, $destination) | Out-Null
                            foreach ($target in $queriedHosts) {
                                if (-not $hostAddresses.ContainsKey($target)) {
                                    $hostQuery = New-MdnsQuery $target 1
                                    $client.Send($hostQuery, $hostQuery.Length, $destination) | Out-Null
                                }
                            }
                        }
                    } catch [System.Net.Sockets.SocketException] {
                        Write-Verbose "mDNS query could not be retried: $($_.Exception.Message)"
                    }
                }

                $nextQuerySeconds++
            }

            foreach ($client in $clients) {
                try {
                    if (-not $client.Client.Poll(0, [System.Net.Sockets.SelectMode]::SelectRead)) {
                        continue
                    }

                    $sender = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0)
                    $packet = $client.Receive([ref]$sender)
                } catch [System.Net.Sockets.SocketException] {
                    Write-Verbose "mDNS response could not be received: $($_.Exception.Message)"
                    continue
                }
                if ($sender.Port -ne 5353) {
                    continue
                }

                try {
                    $records = @(Read-MdnsRecords $packet)
                } catch [System.FormatException] {
                    Write-Verbose "Ignoring an invalid mDNS response: $($_.Exception.Message)"
                    continue
                }

                foreach ($record in $records) {
                    if ($record.Kind -eq 'Address') {
                        $hostAddresses[$record.Name] = $record.Address
                    } elseif ($record.Name.EndsWith(".$serviceName", [System.StringComparison]::OrdinalIgnoreCase)) {
                        $services[$record.Name] = $record
                    }
                }

                foreach ($service in $services.Values) {
                    if (-not $hostAddresses.ContainsKey($service.Target) -and $queriedHosts.Add($service.Target)) {
                        $hostQuery = New-MdnsQuery $service.Target 1
                        try {
                            $client.Send($hostQuery, $hostQuery.Length, $sender) | Out-Null
                        } catch [System.Net.Sockets.SocketException] {
                            Write-Verbose "mDNS hostname query could not be sent: $($_.Exception.Message)"
                        }
                    }
                }
            }

            [System.Threading.Thread]::Sleep(25)
        }
    } finally {
        foreach ($client in $clients) {
            $client.Dispose()
        }
    }

    $addresses = foreach ($service in $services.Values) {
        if ($hostAddresses.ContainsKey($service.Target)) {
            $endpoint = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse($hostAddresses[$service.Target]), $service.Port)
            $endpoint.ToString()
        }
    }

    return @($addresses | Sort-Object -Unique)
}

Export-ModuleMember -Function Find-NetworkMdnsServices
