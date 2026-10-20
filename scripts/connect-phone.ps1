$ErrorActionPreference = 'Stop'

$ForwardedPorts = @(5173, 8080)
$WaitSeconds = 60

function Find-MdnsService([string]$ServiceType) {
    $services = adb mdns services 2>$null
    foreach ($line in $services) {
        if ($line -match "$([regex]::Escape($ServiceType))\s+(\S+:\d+)") {
            return $Matches[1]
        }
    }

    return $null
}

function Wait-MdnsService([string]$ServiceType, [string]$Prompt) {
    Write-Host $Prompt
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $address = Find-MdnsService $ServiceType
        if ($address) {
            return $address
        }

        Start-Sleep -Seconds 2
    }

    throw "The phone did not show up on the network within $WaitSeconds seconds. Check that it is on the same Wi-Fi as this computer."
}

function Connect-Phone([string]$Address) {
    $output = adb connect $Address 2>&1 | Out-String
    $isConnected = $output -match 'connected to'

    return $isConnected
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
    throw 'adb is not installed. Run: winget install Google.PlatformTools, then open a new terminal.'
}

$env:ADB_MDNS_AUTO_CONNECT = '0'
adb kill-server 2>$null | Out-Null
adb start-server 2>$null | Out-Null

$connectAddress = Find-MdnsService '_adb-tls-connect._tcp'
if (-not $connectAddress) {
    $connectAddress = Wait-MdnsService '_adb-tls-connect._tcp' 'Turn on Developer options > Wireless debugging on the phone...'
}

if (-not (Connect-Phone $connectAddress)) {
    $pairingAddress = Wait-MdnsService '_adb-tls-pairing._tcp' 'The phone is not paired yet. On the phone open Wireless debugging > Pair device with pairing code...'
    $pairingCode = Read-Host 'Pairing code shown on the phone'
    adb pair $pairingAddress $pairingCode
    if ($LASTEXITCODE -ne 0) {
        throw 'Pairing failed. Open the pairing dialog again and rerun this script.'
    }

    $connectAddress = Wait-MdnsService '_adb-tls-connect._tcp' 'Waiting for the phone to accept connections...'
    if (-not (Connect-Phone $connectAddress)) {
        throw "Could not connect to $connectAddress."
    }
}

Wait-StableDevice $connectAddress

adb -s $connectAddress reverse --remove-all | Out-Null
foreach ($port in $ForwardedPorts) {
    adb -s $connectAddress reverse "tcp:$port" "tcp:$port" | Out-Null
}

try {
    Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {
    Write-Warning 'The dev server does not answer on http://localhost:5173. Start it with: docker compose up -d'
}

Write-Host "Connected to $connectAddress and forwarded ports $($ForwardedPorts -join ', ')."
Write-Host 'Open http://localhost:5173 in Chrome on the phone.'
