Write-Host "Checking for Node.js..."

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$toolsRoot = Join-Path $repoRoot "tools"
$nodeInstallRoot = Join-Path $toolsRoot "nodejs"
$nodeExecutable = Join-Path $nodeInstallRoot "node.exe"
$npmCommand = Join-Path $nodeInstallRoot "npm.cmd"
$npmInstallRoot = Join-Path $nodeInstallRoot "node_modules\npm"
$nodeServerRoot = Join-Path $PSScriptRoot "nodeserver"
$desktopRuntimeVersion = "8.0.15"
$desktopRuntimeMetadataUrl = "https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/8.0/releases.json"
$desktopRuntimeDirectInstallerUrl = "https://builds.dotnet.microsoft.com/dotnet/WindowsDesktop/8.0.15/windowsdesktop-runtime-8.0.15-win-x64.exe"
$vcRedistDownloadUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"

function Write-Section {
	param(
		[string]$Message
	)

	Write-Host ""
	Write-Host "==== $Message ===="
}

function Write-DownloadNotice {
	param(
		[string]$Name,
		[string]$Url
	)

	Write-Host "[DOWNLOAD] $Name"
	Write-Host "[SOURCE]   $Url"
}

function Test-DotNetDesktopRuntime8015Installed {
	$requiredVersion = [version]$desktopRuntimeVersion
	$detectedVersions = New-Object System.Collections.Generic.List[version]

	function Add-VersionIfValid {
		param(
			[string]$VersionText
		)

		if ([string]::IsNullOrWhiteSpace($VersionText)) {
			return
		}

		try {
			$parsed = [version]($VersionText.Trim().TrimStart('v', 'V'))
			$detectedVersions.Add($parsed)
		} catch {
			# Ignore invalid version strings.
		}
	}

	# Primary check: shared framework folders on disk.
	$sharedFrameworkPaths = @(
		(Join-Path $env:ProgramFiles "dotnet\shared\Microsoft.WindowsDesktop.App"),
		(Join-Path ${env:ProgramFiles(x86)} "dotnet\shared\Microsoft.WindowsDesktop.App")
	)

	foreach ($sharedPath in $sharedFrameworkPaths) {
		if (-not $sharedPath -or -not (Test-Path $sharedPath)) {
			continue
		}

		$folders = Get-ChildItem -Path $sharedPath -Directory -ErrorAction SilentlyContinue
		foreach ($folder in $folders) {
			Add-VersionIfValid -VersionText $folder.Name
		}
	}

	# Secondary check: official .NET sharedfx registry keys.
	$sharedFxRoot = "HKLM:\SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App"
	if (Test-Path $sharedFxRoot) {
		$subKeys = Get-ChildItem -Path $sharedFxRoot -ErrorAction SilentlyContinue
		foreach ($subKey in $subKeys) {
			Add-VersionIfValid -VersionText $subKey.PSChildName
		}
	}

	# Tertiary check: dotnet CLI runtime listing.
	try {
		$runtimeLines = & dotnet --list-runtimes 2>$null
		if ($LASTEXITCODE -eq 0) {
			foreach ($line in $runtimeLines) {
				if ($line -match '^Microsoft\.WindowsDesktop\.App\s+([0-9]+\.[0-9]+\.[0-9]+)\s+\[') {
					Add-VersionIfValid -VersionText $Matches[1]
				}
			}
		}
	} catch {
		# dotnet CLI not available, continue with remaining checks.
	}

	# Last-resort check: uninstall entries (less reliable formatting).
	$uninstallRoots = @(
		"HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
		"HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
	)

	foreach ($root in $uninstallRoots) {
		if (-not (Test-Path $root)) {
			continue
		}

		$entries = Get-ChildItem -Path $root -ErrorAction SilentlyContinue
		foreach ($entry in $entries) {
			$displayName = (Get-ItemProperty -Path $entry.PSPath -ErrorAction SilentlyContinue).DisplayName
			if ($displayName -match '^Microsoft Windows Desktop Runtime - ([0-9]+\.[0-9]+\.[0-9]+) \(x64\)$') {
				Add-VersionIfValid -VersionText $Matches[1]
			}
		}
	}

	foreach ($version in $detectedVersions | Sort-Object -Descending -Unique) {
		if ($version -ge $requiredVersion) {
			Write-Host "Detected .NET Desktop Runtime version: $version"
			return $true
		}
	}

	return $false
}

function Get-DotNetDesktopRuntimeInstallerUrl {
	try {
		$metadata = Invoke-RestMethod -Uri $desktopRuntimeMetadataUrl
		$release = $metadata.releases | Where-Object {
			$_.'release-version' -eq $desktopRuntimeVersion
		} | Select-Object -First 1

		if ($release -and $release.'windowsdesktop-runtime' -and $release.'windowsdesktop-runtime'.files) {
			$runtimeFile = $release.'windowsdesktop-runtime'.files | Where-Object {
				$_.name -eq "windowsdesktop-runtime-$desktopRuntimeVersion-win-x64.exe"
			} | Select-Object -First 1

			if ($runtimeFile -and $runtimeFile.url) {
				return $runtimeFile.url
			}
		}
	} catch {
		Write-Warning "Could not resolve installer URL from .NET release metadata: $($_.Exception.Message)"
	}

	Write-Warning "Falling back to direct .NET installer URL."
	return $desktopRuntimeDirectInstallerUrl
}

function Install-DotNetDesktopRuntime8015 {
	Write-Section ".NET Desktop Runtime"
	Write-Host "Downloading .NET Desktop Runtime 8.0.15 (x64)..."

	[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
	$installerUrl = Get-DotNetDesktopRuntimeInstallerUrl
	Write-DownloadNotice -Name ".NET Desktop Runtime 8.0.15 (x64)" -Url $installerUrl

	$tempRoot = Join-Path $env:TEMP "bg3afr-dotnet-runtime"
	$installerPath = Join-Path $tempRoot "windowsdesktop-runtime-8.0.15-win-x64.exe"

	New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
	Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -MaximumRedirection 10

	if (-not (Test-Path $installerPath)) {
		throw "Failed to download the .NET Desktop Runtime installer."
	}

	$fileInfo = Get-Item -Path $installerPath
	if ($fileInfo.Length -lt 1024KB) {
		throw "Downloaded .NET installer is unexpectedly small; download may have failed."
	}

	Write-Host "Installing .NET Desktop Runtime 8.0.15 (x64)..."
	Write-Host "If Windows asks for permission to run this installer (UAC/SmartScreen), please allow it to continue."
	try {
		$process = Start-Process -FilePath $installerPath -ArgumentList @("/install", "/quiet", "/norestart") -Wait -PassThru
	} catch {
		throw "Failed to launch the .NET installer executable: $($_.Exception.Message)"
	}

	if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
		throw ".NET Desktop Runtime installer failed with exit code $($process.ExitCode)."
	}

	Write-Host ".NET Desktop Runtime installer completed with exit code $($process.ExitCode)."
}

function Get-InstalledVcRedistX64Version {
	$vcRuntimeKey = "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"

	if (-not (Test-Path $vcRuntimeKey)) {
		return $null
	}

	$runtime = Get-ItemProperty -Path $vcRuntimeKey -ErrorAction SilentlyContinue
	if (-not $runtime -or $runtime.Installed -ne 1 -or -not $runtime.Version) {
		return $null
	}

	try {
		return [version]($runtime.Version.ToString().TrimStart('v', 'V'))
	} catch {
		return $null
	}
}

function Install-LatestVcRedistX64 {
	Write-Section "Microsoft Visual C++ Redistributable"
	Write-Host "Checking for latest Microsoft Visual C++ Redistributable (x64)..."

	$installedVersion = Get-InstalledVcRedistX64Version
	if ($installedVersion) {
		Write-Host "Microsoft Visual C++ Redistributable (x64) is already installed: $installedVersion"
		Write-Host "Skipping download/install for vc_redist.x64.exe."
		return
	}

	[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

	$tempRoot = Join-Path $env:TEMP "bg3afr-vcredist"
	$installerPath = Join-Path $tempRoot "vc_redist.x64.exe"

	New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
	Write-DownloadNotice -Name "Microsoft Visual C++ Redistributable (x64)" -Url $vcRedistDownloadUrl
	Invoke-WebRequest -Uri $vcRedistDownloadUrl -OutFile $installerPath -MaximumRedirection 10

	if (-not (Test-Path $installerPath)) {
		throw "Failed to download vc_redist.x64 installer."
	}

	$installerVersion = $null
	try {
		$installerVersion = [version](Get-Item -Path $installerPath).VersionInfo.FileVersionRaw
	} catch {
		$installerVersion = $null
	}

	Write-Host "Installing Microsoft Visual C++ Redistributable (x64)..."
	Write-Host "If Windows asks for permission to run this installer (UAC/SmartScreen), please allow it to continue."

	try {
		$process = Start-Process -FilePath $installerPath -ArgumentList @("/install", "/quiet", "/norestart") -Wait -PassThru
	} catch {
		throw "Failed to launch vc_redist.x64 installer: $($_.Exception.Message)"
	}

	if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010 -and $process.ExitCode -ne 1638) {
		throw "vc_redist.x64 installer failed with exit code $($process.ExitCode)."
	}

	$newVersion = Get-InstalledVcRedistX64Version
	if (-not $newVersion) {
		throw "Failed to verify Microsoft Visual C++ Redistributable (x64) after installation."
	}

	Write-Host "Microsoft Visual C++ Redistributable (x64) is installed: $newVersion"
}

function Get-LatestWindowsX64NodeRelease {
	$releaseIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
	return $releaseIndex | Where-Object {
		$_.lts -and ($_.files -contains "win-x64-zip")
	} | Select-Object -First 1
}

function Install-PortableNode {
	Write-Section "Node.js"
	Write-Host "Node.js is not installed locally. Downloading a portable 64-bit build into tools..."

	[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

	$release = Get-LatestWindowsX64NodeRelease

	if (-not $release) {
		throw "Could not determine the latest Windows x64 Node.js release."
	}

	$version = $release.version
	$archiveName = "node-$version-win-x64.zip"
	$downloadUrl = "https://nodejs.org/dist/$version/$archiveName"
	Write-DownloadNotice -Name "Node.js $version (win-x64 zip)" -Url $downloadUrl
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

function Stop-ProcessOnPort {
	param(
		[int]$Port
	)

	$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

	foreach ($connection in $connections) {
		if ($connection.OwningProcess) {
			try {
				Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
				Write-Host "Stopped existing process on port $Port (PID $($connection.OwningProcess))."
			} catch {
				Write-Warning "Could not stop PID $($connection.OwningProcess) on port ${Port}: $($_.Exception.Message)"
			}
		}
	}
}

function Install-NpmToTools {
	Write-Section "npm"
	Write-Host "npm is not installed locally. Downloading a portable copy into the tools folder..."

	[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

	$npmMetadata = Invoke-RestMethod -Uri "https://registry.npmjs.org/npm/latest"
	$npmVersion = $npmMetadata.version
	$tarballUrl = $npmMetadata.dist.tarball
	Write-DownloadNotice -Name "npm $npmVersion" -Url $tarballUrl
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

function Install-NodeServerDependencies {
	if (-not (Test-Path $nodeServerRoot)) {
		throw "The nodeserver folder was not found at $nodeServerRoot."
	}

	Write-Host "Running npm install in nodeserver..."
	Push-Location $nodeServerRoot
	try {
		& $npmCommand install
	} finally {
		Pop-Location
	}
	Write-Host "npm install completed in nodeserver."
}

function Wait-ForTcpPort {
	param(
		[string]$HostName,
		[int]$Port,
		[int]$TimeoutSeconds = 30
	)

	$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

	while ((Get-Date) -lt $deadline) {
		try {
			$client = New-Object System.Net.Sockets.TcpClient
			$asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
			if ($asyncResult.AsyncWaitHandle.WaitOne(500)) {
				$client.EndConnect($asyncResult)
				$client.Close()
				return $true
			}
			$client.Close()
		} catch {
			if ($client) {
				$client.Close()
			}
		}

		[System.Threading.Thread]::Sleep(500)
	}

	return $false
}

function Start-NodeServerAndOpenHomepage {
	$serverScript = Join-Path $nodeServerRoot "index.js"

	if (-not (Test-Path $serverScript)) {
		throw "The node server entrypoint was not found at $serverScript."
	}

	Stop-ProcessOnPort -Port 3001

	Write-Host "Launching the Node.js server on port 3001..."
	$serverCommand = "Set-Location -LiteralPath '$nodeServerRoot'; & '$nodeExecutable' '$serverScript'"
	Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-Command", $serverCommand) -WindowStyle Normal | Out-Null

	if (Wait-ForTcpPort -HostName "localhost" -Port 3001 -TimeoutSeconds 30) {
		Write-Host "Opening the homepage in your browser..."
		Start-Process "http://localhost:3001" | Out-Null
	} else {
		Write-Warning "The server did not become ready on port 3001 within 30 seconds."
	}
}

Write-Host "Checking for .NET Desktop Runtime 8.0.15 (x64)..."
if (Test-DotNetDesktopRuntime8015Installed) {
	Write-Host ".NET Desktop Runtime 8.0.15 (x64) is installed."
} else {
	Write-Warning ".NET Desktop Runtime 8.0.15 (x64) is not installed. Installing it now..."
	Install-DotNetDesktopRuntime8015

	if (Test-DotNetDesktopRuntime8015Installed) {
		Write-Host ".NET Desktop Runtime 8.0.15 (x64) is now installed."
	} else {
		throw "Failed to verify .NET Desktop Runtime 8.0.15 (x64) after installation."
	}
}

Install-LatestVcRedistX64

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

Install-NodeServerDependencies
Start-NodeServerAndOpenHomepage
