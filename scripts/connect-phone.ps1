#Requires -Version 7
$ErrorActionPreference = 'Stop'

$DevServerPort = 5173
$ForwardedPorts = [ordered]@{
    $DevServerPort = 'The dev server'
    8080 = 'The mock sign-in server (mock-oidc)'
}
$WaitSeconds = 60
$ConnectRetrySeconds = 10

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

function Connect-AnyPhone {
    $deadline = (Get-Date).AddSeconds($ConnectRetrySeconds)
    while ((Get-Date) -lt $deadline) {
        foreach ($address in Find-MdnsServices '_adb-tls-connect._tcp') {
            $output = adb connect $address 2>&1 | Out-String
            if ($output -match 'connected to') {
                return $address
            }
        }

        Start-Sleep -Seconds 2
    }

    return $null
}

function Wait-StableDevice([string]$Serial) {
    $stableChecks = 0
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $state = (adb -s $Serial get-state 2>$null | Out-String).Trim()
        if ($state -eq 'device') {
            $stableChecks++
            if ($stableChecks -ge 3) {
                return
            }
        } else {
            $stableChecks = 0
        }

        Start-Sleep -Seconds 1
    }

    throw "The connection to $Serial did not settle. Turn wireless debugging off and on again, then rerun this script."
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    $env:Path = @(
        [Environment]::GetEnvironmentVariable('Path', 'Machine')
        [Environment]::GetEnvironmentVariable('Path', 'User')
    ) -join ';'
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    throw 'adb is not installed. Run: winget install Google.PlatformTools'
}

$previousAutoConnect = $env:ADB_MDNS_AUTO_CONNECT
try {
    $env:ADB_MDNS_AUTO_CONNECT = '0'
    adb kill-server 2>$null | Out-Null
    adb start-server 2>$null | Out-Null

    Wait-MdnsServices '_adb-tls-connect._tcp' 'Looking for the phone. If wireless debugging is off, turn on Developer options > Wireless debugging...' | Out-Null
    $connectAddress = Connect-AnyPhone
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

    Wait-StableDevice $connectAddress

    adb -s $connectAddress reverse --remove-all | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not clear the old forwards on $connectAddress. Rerun this script."
    }

    foreach ($port in $ForwardedPorts.Keys) {
        adb -s $connectAddress reverse "tcp:$port" "tcp:$port" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not forward port $port to $connectAddress. Rerun this script."
        }
    }
} finally {
    $env:ADB_MDNS_AUTO_CONNECT = $previousAutoConnect
}

foreach ($service in $ForwardedPorts.GetEnumerator()) {
    if (-not (Test-Connection -TargetName localhost -TcpPort $service.Key -TimeoutSeconds 5 -Quiet)) {
        Write-Warning "$($service.Value) does not answer on localhost:$($service.Key). Start the app with: docker compose up -d"
    }
}

Write-Host "Connected to $connectAddress and forwarded ports $($ForwardedPorts.Keys -join ', ')."
Write-Host "Open http://localhost:$DevServerPort in Chrome on the phone."
