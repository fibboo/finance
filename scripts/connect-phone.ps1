#Requires -Version 7
$ErrorActionPreference = 'Stop'

$DevServerPort = 5173
$ForwardedPorts = [ordered]@{
    $DevServerPort = 'The dev server'
    8080 = 'The mock sign-in server (mock-oidc)'
}
$WaitSeconds = 60
$ConnectRetrySeconds = 10
$WatchIntervalSeconds = 5

function Find-MdnsServices([string]$ServiceType) {
    $services = adb mdns services 2>$null
    $addresses = foreach ($line in $services) {
        if ($line -match "$([regex]::Escape($ServiceType))\s+(\S+:\d+)") {
            $Matches[1]
        }
    }

    return @($addresses)
}

function Wait-MdnsServices([string]$ServiceType, [string]$Prompt) {
    Write-Host $Prompt
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $addresses = Find-MdnsServices $ServiceType
        if ($addresses) {
            return $addresses
        }

        Start-Sleep -Seconds 2
    }

    throw "The phone did not show up on the network within $WaitSeconds seconds. Check that wireless debugging is on and that the phone is on the same Wi-Fi as this computer."
}

function Connect-AnyPhone([string[]]$KnownAddresses = @()) {
    $deadline = (Get-Date).AddSeconds($ConnectRetrySeconds)
    while ((Get-Date) -lt $deadline) {
        foreach ($address in @($KnownAddresses) + (Find-MdnsServices '_adb-tls-connect._tcp')) {
            $output = adb connect $address 2>&1 | Out-String
            if ($output -match 'connected to') {
                return $address
            }
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
            adb disconnect $Matches[1] 2>&1 | Out-Null
        }
    }
}

function Test-StableDevice([string]$Serial) {
    $stableChecks = 0
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $state = (adb -s $Serial get-state 2>$null | Out-String).Trim()
        if ($state -eq 'device') {
            $stableChecks++
            if ($stableChecks -ge 3) {
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
    adb -s $Serial reverse --remove-all | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not clear the old forwards on $Serial."
    }

    foreach ($port in $ForwardedPorts.Keys) {
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
    adb start-server 2>$null | Out-Null
    Remove-StaleConnections

    $connectAddress = Find-ConnectedPhone
    if (-not $connectAddress) {
        Wait-MdnsServices '_adb-tls-connect._tcp' 'Looking for the phone. If wireless debugging is off, turn on Developer options > Wireless debugging...' | Out-Null
        $connectAddress = Connect-AnyPhone
    }

    if (-not $connectAddress) {
        $pairingAddress = (Wait-MdnsServices '_adb-tls-pairing._tcp' 'No phone accepted the connection, so it is not paired yet. On the phone open Wireless debugging > Pair device with pairing code...')[0]
        $pairingCode = Read-Host 'Pairing code shown on the phone'
        adb pair $pairingAddress $pairingCode
        if ($LASTEXITCODE -ne 0) {
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
