# One-command installer for LM Studio native chatbot provider (Windows, admin PowerShell).
# Merges policies/lm-studio.json into HKLM:\SOFTWARE\Policies\Mozilla\Firefox\AIChatbot
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-policy-windows.ps1
$ErrorActionPreference = "Stop"
$src = Join-Path (Split-Path $PSScriptRoot -Parent) "policies\lm-studio.json"
Write-Host "Source: $src"
$data = Get-Content $src -Raw | ConvertFrom-Json
$add = $data.policies.AIChatbot.Providers.Add[0]
$base = "HKLM:\SOFTWARE\Policies\Mozilla\Firefox\AIChatbot\Providers"
# Find slot: reuse the entry with our id, else the first free/reusable slot.
# Never break on the first gap before checking later slots for our id (that
# duplicated us on re-run), and never fall back onto another provider's slot.
$slot = $null
$free = $null
for ($i = 1; $i -le 20; $i++) {
  $p = "$base\Add\$i"
  if (-not (Test-Path $p)) {
    if (-not $free) { $free = $i }
    continue
  }
  try {
    $existingId = (Get-ItemProperty -Path $p -Name "id" -ErrorAction Stop).id
    if ($existingId -eq $add.id) { $slot = $i; break }  # our entry: reuse
  } catch {
    # Slot exists but has no id — not a valid provider entry, safe to reuse.
    if (-not $free) { $free = $i }
  }
}
if (-not $slot) { $slot = $free }
if (-not $slot) {
  throw "All Add\1-20 slots are in use; refusing to overwrite another provider."
}
New-Item -Path "$base\Add\$slot" -Force | Out-Null
Set-ItemProperty -Path "$base\Add\$slot" -Name "id" -Value $add.id
Set-ItemProperty -Path "$base\Add\$slot" -Name "name" -Value $add.name
Set-ItemProperty -Path "$base\Add\$slot" -Name "url" -Value $add.url
Set-ItemProperty -Path "$base\Add\$slot" -Name "iconUrl" -Value $add.iconUrl
Set-ItemProperty -Path "$base\Add\$slot" -Name "queryParam" -Value $add.queryParam
New-Item -Path "$base\BuiltIn" -Force | Out-Null
# Only ensure localhost stays enabled; don't touch other BuiltIn keys users may have disabled
Set-ItemProperty -Path "$base\BuiltIn" -Name "localhost" -Value 1 -Type DWord
# Make our provider the default, same as the shipped JSON + Linux installer
Set-ItemProperty -Path $base -Name "Default" -Value "LM Studio (local)"
Write-Host "Done (slot $slot, merged). Restart Firefox, check about:policies, pick 'LM Studio (local)'."
