[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Distribution = 'Ubuntu',
    [string]$Python = 'python3',
    [string]$EnvironmentPath,
    [ValidatePattern('^\d+\.\d+(\.\d+)?$')][string]$Version = '26.8',
    [switch]$Yes,
    [switch]$Upgrade,
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot 'scripts\install-pyats-genie.py'
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw "Installer not found: $installer" }
if (-not $PSCmdlet.ShouldProcess("WSL distribution '$Distribution'", $(if ($CheckOnly) { 'Check Genie runtime' } else { 'Install pyATS/Genie into a dedicated virtualenv' }))) { return }
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { throw 'WSL is not installed. Use the Python installer on Linux/macOS; no Windows features were changed.' }
& wsl.exe -d $Distribution --exec /bin/true
if ($LASTEXITCODE -ne 0) {
    throw 'WSL cannot start. This is a runtime prerequisite, not a pip problem. No packages were installed. Do not enable Hyper-V blindly if this PC hosts a VMware/CML lab; run scripts/install-pyats-genie.py in an available Linux environment instead.'
}
& wsl.exe -d $Distribution --exec $Python -c 'import sys; print(sys.version); sys.exit(0 if sys.version_info >= (3, 10) else 1)'
if ($LASTEXITCODE -ne 0) { throw 'Selected Linux Python could not start or is older than 3.10. Use -Python with a supported interpreter path.' }
if (-not $CheckOnly -and -not $Yes) {
    Write-Host 'This downloads pyATS/Genie from PyPI into a dedicated Linux virtualenv. It does not modify system Python, enable virtualization or change NetClaw configuration.'
    if ((Read-Host 'Continue? Type YES').Trim() -cne 'YES') { Write-Host 'Cancelled.'; return }
}
$linuxScript = & wsl.exe -d $Distribution --exec wslpath -a $installer
if ($LASTEXITCODE -ne 0 -or -not $linuxScript) { throw 'Could not resolve the installer path inside WSL.' }
$installArgs = @('-d', $Distribution, '--exec', $Python, ([string]$linuxScript).Trim(), '--version', $Version)
if ($EnvironmentPath) { $installArgs += @('--venv', $EnvironmentPath) }
if ($CheckOnly) { $installArgs += '--check-only' } else { $installArgs += '--yes' }
if ($Upgrade) { $installArgs += '--upgrade' }
& wsl.exe @installArgs
if ($LASTEXITCODE -ne 0) { throw 'Genie runtime is not ready. Review the installer output above; nothing was connected to a router.' }
Write-Host "PYATS_WSL_DISTRO=$Distribution"
Write-Host 'Use the printed PYATS_PYTHON path with this distribution. Existing NetClaw environment files were not modified.'
