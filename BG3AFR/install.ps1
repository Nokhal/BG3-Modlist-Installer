Write-Host "Checking for Node.js..."

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$toolsRoot = Join-Path $repoRoot "tools"
$nodeInstallRoot = Join-Path $toolsRoot "nodejs"
$nodeExecutable = Join-Path $nodeInstallRoot "node.exe"
$npmCommand = Join-Path $nodeInstallRoot "npm.cmd"
$npmInstallRoot = Join-Path $nodeInstallRoot "node_modules\npm"

function Get-LatestWindowsX64NodeRelease {
	$releaseIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
	return $releaseIndex | Where-Object {
		$_.lts -and ($_.files -contains "win-x64-zip")
	} | Select-Object -First 1
}

function Install-PortableNode {
	Write-Host "Node.js is not installed locally. Downloading a portable 64-bit build into tools..."

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

	Remove-Item -Recurse -Force $nodeInstallRoot -ErrorAction SilentlyContinue
	New-Item -ItemType Directory -Force -Path $nodeInstallRoot | Out-Null
	Copy-Item -Path (Join-Path $expandedFolder.FullName "*") -Destination $nodeInstallRoot -Recurse -Force

	$nodeVersion = & $nodeExecutable --version
	Write-Host "Node.js was downloaded and installed to tools: $nodeVersion"
}

function Write-NpmShims {
	@'
@ECHO OFF
SETLOCAL
SET "NODE_EXE=%~dp0node.exe"
"%NODE_EXE%" "%~dp0node_modules\npm\bin\npm-cli.js" %*
'@ | Set-Content -Path $npmCommand -Encoding ASCII

	@'
@ECHO OFF
SETLOCAL
SET "NODE_EXE=%~dp0node.exe"
"%NODE_EXE%" "%~dp0node_modules\npm\bin\npx-cli.js" %*
'@ | Set-Content -Path (Join-Path $nodeInstallRoot "npx.cmd") -Encoding ASCII
}

function Install-NpmToTools {
	Write-Host "npm is not installed locally. Downloading a portable copy into tools..."

	[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

	$npmMetadata = Invoke-RestMethod -Uri "https://registry.npmjs.org/npm/latest"
	$npmVersion = $npmMetadata.version
	$tarballUrl = $npmMetadata.dist.tarball
	$tempRoot = Join-Path $env:TEMP "bg3afr-npm"
	$tarballPath = Join-Path $tempRoot "npm-$npmVersion.tgz"
	$extractPath = Join-Path $tempRoot "extract"

	New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
	Remove-Item -Recurse -Force $extractPath -ErrorAction SilentlyContinue
	New-Item -ItemType Directory -Force -Path $extractPath | Out-Null

	Invoke-WebRequest -Uri $tarballUrl -OutFile $tarballPath
	tar -xf $tarballPath -C $extractPath

	$packageFolder = Join-Path $extractPath "package"

	if (-not (Test-Path (Join-Path $packageFolder "bin\npm-cli.js"))) {
		throw "The downloaded npm package did not contain the expected files."
	}

	Remove-Item -Recurse -Force $npmInstallRoot -ErrorAction SilentlyContinue
	New-Item -ItemType Directory -Force -Path $npmInstallRoot | Out-Null
	Copy-Item -Path (Join-Path $packageFolder "*") -Destination $npmInstallRoot -Recurse -Force
	Write-NpmShims

	$env:Path = "$nodeInstallRoot;$env:Path"
	$installedNpmVersion = & $npmCommand --version
	Write-Host "npm was downloaded and installed to tools: $installedNpmVersion"
}

if (-not (Test-Path $nodeExecutable)) {
	Install-PortableNode
	$env:Path = "$nodeInstallRoot;$env:Path"
}

$env:Path = "$nodeInstallRoot;$env:Path"

$installedVersion = & $nodeExecutable --version

Write-Host "Node.js is available in tools: $installedVersion"

if (-not (Test-Path $npmCommand)) {
	Install-NpmToTools
} else {
	$installedNpmVersion = & $npmCommand --version
	Write-Host "npm is available in tools: $installedNpmVersion"
}
