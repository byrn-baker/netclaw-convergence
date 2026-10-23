param(
    [string]$AgentWorkspace = (Join-Path $env:USERPROFILE '.openclaw\workspace'),
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$policyPath = Join-Path $PSScriptRoot 'ui\netclaw-visual\LOCAL-LAB-CHANGE-CONTROL.md'
$sourcePath = Join-Path $PSScriptRoot 'ui\netclaw-visual\local-lab-agent-note.md'
$agentFile = Join-Path $AgentWorkspace 'AGENTS.md'
if (-not (Test-Path -LiteralPath $policyPath -PathType Leaf) -or -not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { throw 'Local/Lab policy files are missing from this checkout.' }
if (-not (Test-Path -LiteralPath $agentFile -PathType Leaf)) { throw 'The selected agent workspace has no AGENTS.md; choose its actual configured workspace.' }
$original = [IO.File]::ReadAllText($agentFile)
$marker = '<!-- netclaw-terminal-local-lab-policy-v1 -->'
if ($original.Contains($marker)) { Write-Output 'NetClaw Local/Lab policy note is already installed. No files changed.'; return }
if ($CheckOnly) { Write-Output "Ready to install the scoped Local/Lab policy note in $agentFile. No devices will be authorized automatically."; return }
$note = [IO.File]::ReadAllText($sourcePath).Replace('{{POLICY_PATH}}', $policyPath)
$backup = "$agentFile.netclaw-lab-backup-$([Guid]::NewGuid().ToString('N'))"
[IO.File]::Copy($agentFile, $backup, $false)
# Preserve existing content exactly; append only the owner-approved policy note.
# Verify no other actor changed the file between our read and backup.
if ([IO.File]::ReadAllText($agentFile) -cne $original) { throw 'AGENTS.md changed during installation; nothing was appended. Retry after reviewing it.' }
[IO.File]::AppendAllText($agentFile, "`r`n`r`n$note`r`n", [Text.UTF8Encoding]::new($false))
Write-Output "Installed scoped Local/Lab policy note. Backup: $backup"
Write-Output 'Production defaults are unchanged. Designate lab devices explicitly in Canvas Change control.'
