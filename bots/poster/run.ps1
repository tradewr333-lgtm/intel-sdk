# Degenscan Intel poster — one-shot runner for Windows (also used by Task Scheduler)
Set-Location $PSScriptRoot
Get-Content .env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
python -m pip install -q -r requirements.txt
python poster.py
