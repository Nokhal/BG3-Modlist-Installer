Write-Host "Checking for Node.js..."

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$toolsRoot = Join-Path $repoRoot "tools"
$nodeInstallRoot = Join-Path $toolsRoot "nodejs"
$nodeExecutable = Join-Path $nodeInstallRoot "node.exe"

function Get-LatestWindowsX64NodeRelease {
	$releaseIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
	return $releaseIndex | Where-Object {
		$_.lts -and ($_.files -contains "win-x64-zip")
	} | Select-Object -First 1
}

if (Test-Path $nodeExecutable) {
	$nodeVersion = & $nodeExecutable --version
	Write-Host "Node.js is installed in tools: $nodeVersion"
	exit 0
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCommand) {
	$nodeVersion = & node --version
	Write-Host "Node.js is installed: $nodeVersion"
	exit 0
}

Write-Host "Node.js is not installed. Downloading a portable 64-bit build into tools..."

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$release = Get-LatestWindowsX64NodeRelease

if (-not $release) {
	throw "Could not determine the latest Windows x64 Node.js release."
}

$version = $release.version
$archiveName = "node-$version-win-x64.zip"
$downloadUrl = "https://nodejs.org/dist/$version/$archiveName"
$tempRoot = Join-Path $env:TEMP "bg3afr-node"
$archivePath = Join-Path $tempRoot $archiveName
$extractPath = Join-Path $tempRoot "extract"

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
Remove-Item -Recurse -Force $extractPath -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extractPath | Out-Null

Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
Expand-Archive -Path $archivePath -DestinationPath $extractPath -Force

$expandedFolder = Get-ChildItem -Path $extractPath -Directory | Where-Object {
	$_.Name -like "node-*win-x64"
} | Select-Object -First 1

if (-not $expandedFolder) {
	throw "The downloaded Node.js archive did not contain the expected folder structure."
}

New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
Remove-Item -Recurse -Force $nodeInstallRoot -ErrorAction SilentlyContinue
Move-Item -Path $expandedFolder.FullName -Destination $nodeInstallRoot

$env:Path = "$nodeInstallRoot;$env:Path"
$installedVersion = & $nodeExecutable --version

Write-Host "Node.js was downloaded and installed to tools: $installedVersion"
