#Requires -Version 7
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'mdns-discovery.psm1')

$DevServerPort = 5173
$ForwardedPorts = [ordered]@{
    $DevServerPort = 'The dev server'
    8080 = 'The mock sign-in server (mock-oidc)'
}
$WaitSeconds = 60
$ConnectRetrySeconds = 10
$WatchIntervalSeconds = 5

function Find-MdnsServices([string]$ServiceType) {
    Write-Host "Searching the local network for $ServiceType..."
    $networkAddresses = @(Find-NetworkMdnsServices $ServiceType)
    if ($networkAddresses.Count -gt 0) {
        Write-Host "Found on the network: $($networkAddresses -join ', ')."
        return $networkAddresses
    }

    Write-Host 'No network response. Checking ADB discovery...'
    $services = adb mdns services 2>$null
    $addresses = @(foreach ($line in $services) {
        if ($line -match "$([regex]::Escape($ServiceType))\.?\s+(\S+:\d+)") {
            $Matches[1]
        }
    })

    if ($addresses.Count -gt 0) {
        Write-Host "Found in ADB discovery: $($addresses -join ', ')."
    } else {
        Write-Host "No $ServiceType service found yet."
    }
    return @($addresses)
}

function Wait-MdnsServices([string[]]$ServiceTypes, [string]$Prompt) {
    Write-Host $Prompt
    Write-Host "Waiting up to $WaitSeconds seconds for the pairing service..."
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $addresses = foreach ($serviceType in $ServiceTypes) {
            Find-MdnsServices $serviceType
        }
        if ($addresses) {
            return $addresses
        }

        Start-Sleep -Seconds 2
    }

    throw "The phone did not show up on the network within $WaitSeconds seconds. Check that wireless debugging is on and that the phone is on the same Wi-Fi as this computer."
}

function Connect-AnyPhone([string[]]$KnownAddresses = @(), [ref]$AuthenticationFailed = [ref]$false) {
    $deadline = (Get-Date).AddSeconds($ConnectRetrySeconds)
    while ((Get-Date) -lt $deadline) {
        $wasRejected = $false
        foreach ($address in (@($KnownAddresses) + (Find-MdnsServices '_adb-tls-connect._tcp') | Select-Object -Unique)) {
            Write-Host "Connecting to $address..."
            $output = adb connect $address 2>&1 | Out-String
            Write-Host $output.Trim()
            if ($output -match 'connected to') {
                return $address
            }

            if ($output -match 'failed to authenticate') {
                Write-Host "Authentication was rejected by $address. Pairing is required."
                $wasRejected = $true
                $AuthenticationFailed.Value = $true
            }
        }

        if ($wasRejected) {
            return $null
        }

        Start-Sleep -Seconds 2
    }

    return $null
}

function Find-ConnectedPhone {
    foreach ($line in adb devices 2>$null) {
        if ($line -match '^(\S+(:\d+|\._adb-tls-connect\._tcp))\s+device$') {
            return $Matches[1]
        }
    }

    return $null
}

function Remove-StaleConnections {
    foreach ($line in adb devices 2>$null) {
        if ($line -match '^(\S+:\d+)\s+(\S+)$' -and $Matches[2] -ne 'device') {
            $address = $Matches[1]
            Write-Host "Removing stale ADB connection: $address ($($Matches[2]))."
            adb disconnect $address 2>&1 | Out-Null
            $address
        }
    }
}

function Test-StableDevice([string]$Serial) {
    Write-Host "Checking that $Serial stays connected..."
    $stableChecks = 0
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $state = (adb -s $Serial get-state 2>$null | Out-String).Trim()
        if ($state -eq 'device') {
            $stableChecks++
            if ($stableChecks -ge 3) {
                Write-Host 'The connection is stable.'
                return $true
            }
        } else {
            $stableChecks = 0
        }

        Start-Sleep -Seconds 1
    }

    return $false
}

function Set-Forwards([string]$Serial) {
    Write-Host "Clearing old port forwards on $Serial..."
    adb -s $Serial reverse --remove-all | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not clear the old forwards on $Serial."
    }

    foreach ($port in $ForwardedPorts.Keys) {
        Write-Host "Forwarding phone localhost:$port to computer localhost:$port..."
        adb -s $Serial reverse "tcp:$port" "tcp:$port" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not forward port $port to $Serial."
        }
    }
}

function Test-Forwards([string]$Serial) {
    $forwards = adb -s $Serial reverse --list 2>$null | Out-String
    if ($LASTEXITCODE -ne 0) {
        return $false
    }

    foreach ($port in $ForwardedPorts.Keys) {
        if ($forwards -notmatch "tcp:$port tcp:$port") {
            return $false
        }
    }

    return $true
}

function Restore-Connection([string]$Serial) {
    Write-Host "The connection to $Serial dropped. Reconnecting until the phone answers..."
    if ($Serial -match ':\d+$') {
        adb disconnect $Serial 2>&1 | Out-Null
    }

    while ($true) {
        $address = Find-ConnectedPhone
        if (-not $address) {
            $address = Connect-AnyPhone $Serial
        }

        if ($address) {
            if (Test-StableDevice $address) {
                try {
                    Set-Forwards $address
                    Write-Host "Reconnected to $address."
                    return $address
                } catch {
                    Write-Host $_.Exception.Message
                }
            }

            adb disconnect $address 2>&1 | Out-Null
        }
    }
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    $env:Path = @(
        $env:Path
        [Environment]::GetEnvironmentVariable('Path', 'Machine')
        [Environment]::GetEnvironmentVariable('Path', 'User')
    ) -join ';'
    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        throw 'adb is not installed. Run: winget install Google.PlatformTools'
    }
}

$previousAutoConnect = $env:ADB_MDNS_AUTO_CONNECT
try {
    $env:ADB_MDNS_AUTO_CONNECT = '0'
    Write-Host 'Starting ADB and checking existing wireless connections...'
    adb start-server 2>$null | Out-Null
    $knownAddresses = @(Remove-StaleConnections)
    $authenticationFailed = $false

    $connectAddress = Find-ConnectedPhone
    if ($connectAddress) {
        Write-Host "Using the existing connection to $connectAddress."
    }
    if (-not $connectAddress -and $knownAddresses.Count -gt 0) {
        $connectAddress = Connect-AnyPhone -KnownAddresses $knownAddresses -AuthenticationFailed ([ref]$authenticationFailed)
    }

    if (-not $connectAddress -and -not $authenticationFailed) {
        $discoveredAddresses = @(Find-MdnsServices '_adb-tls-connect._tcp')
        $pairingAddresses = @(Find-MdnsServices '_adb-tls-pairing._tcp')
        if ($discoveredAddresses.Count -gt 0) {
            $connectAddress = Connect-AnyPhone -KnownAddresses $discoveredAddresses -AuthenticationFailed ([ref]$authenticationFailed)
        }

        if (-not $connectAddress -and -not $authenticationFailed -and $pairingAddresses.Count -eq 0) {
            Write-Host 'Automatic discovery did not produce a working connection.'
            $manualAddress = (Read-Host 'Press Enter to pair a new device, or enter IP:port to reconnect a paired device').Trim()
            if ($manualAddress -ne '') {
                $phoneEndpoint = $null
                if (-not [System.Net.IPEndPoint]::TryParse($manualAddress, [ref]$phoneEndpoint) -or $phoneEndpoint.Port -eq 0) {
                    throw 'Enter the IP address and port shown on the main Wireless debugging screen.'
                }

                $connectAddress = Connect-AnyPhone -KnownAddresses $manualAddress -AuthenticationFailed ([ref]$authenticationFailed)
                if (-not $connectAddress -and -not $authenticationFailed) {
                    throw "Could not connect to $manualAddress. Check the address on the main Wireless debugging screen and rerun this script."
                }
            }
        }
    }

    if (-not $connectAddress) {
        Write-Host 'Starting device pairing.'
        $pairingAddress = @(Wait-MdnsServices '_adb-tls-pairing._tcp' 'On the phone, open Wireless debugging > Pair device with pairing code...')[0]
        Write-Host "Found pairing service at $pairingAddress."
        $pairingCode = Read-Host 'Pairing code shown on the phone'
        Write-Host "Pairing with $pairingAddress..."
        $pairingOutput = adb pair $pairingAddress $pairingCode 2>&1 | Out-String
        Write-Host $pairingOutput.Trim()
        if ($LASTEXITCODE -ne 0 -or $pairingOutput -notmatch 'Successfully paired to ') {
            throw 'Pairing failed. Open the pairing dialog again and rerun this script.'
        }

        Write-Host 'Waiting for the phone to accept connections...'
        $connectAddress = Connect-AnyPhone
        if (-not $connectAddress) {
            throw 'The phone was paired but did not accept a connection. Rerun this script.'
        }
    }

    if (-not (Test-StableDevice $connectAddress)) {
        throw "The connection to $connectAddress did not settle. Turn wireless debugging off and on again, then rerun this script."
    }

    Set-Forwards $connectAddress

    foreach ($service in $ForwardedPorts.GetEnumerator()) {
        Write-Host "Checking $($service.Value) on computer localhost:$($service.Key)..."
        if (-not (Test-Connection -TargetName localhost -TcpPort $service.Key -TimeoutSeconds 5 -Quiet)) {
            Write-Warning "$($service.Value) does not answer on localhost:$($service.Key). Start the app with: docker compose up -d"
        }
    }

    Write-Host "Connected to $connectAddress and forwarded ports $($ForwardedPorts.Keys -join ', ')."
    Write-Host "Open http://localhost:$DevServerPort in Chrome on the phone."
    Write-Host 'Keeping the connection alive. Press Ctrl+C to stop.'

    while ($true) {
        Start-Sleep -Seconds $WatchIntervalSeconds
        if (-not (Test-Forwards $connectAddress)) {
            $connectAddress = Restore-Connection $connectAddress
        }
    }
} finally {
    $env:ADB_MDNS_AUTO_CONNECT = $previousAutoConnect
}
