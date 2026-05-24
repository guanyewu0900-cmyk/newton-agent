param(
  [string]$Message = "Update website",
  [switch]$SkipCommit,
  [switch]$NoPull
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RemoteUrl = "https://github.com/guanyewu0900-cmyk/newton-agent.git"
$SafeRoot = $Root -replace "\\", "/"

function Run-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  Write-Host "+ git $($Args -join ' ')" -ForegroundColor Cyan
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Set-Location $Root

if (-not (Test-Path ".git")) {
  Run-Git init
  Run-Git branch -M main
}

Write-Host "+ git config --global --add safe.directory $SafeRoot" -ForegroundColor Cyan
& git config --global --add safe.directory $SafeRoot
if ($LASTEXITCODE -ne 0) {
  Write-Host "Warning: could not update global safe.directory. Continuing because this repository is already accessible." -ForegroundColor Yellow
}

$branch = (& git branch --show-current).Trim()
if (-not $branch) {
  Run-Git branch -M main
  $branch = "main"
}
Write-Host "Branch: $branch"

$origin = (& git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $origin) {
  Run-Git remote add origin $RemoteUrl
} elseif ($origin.Trim() -ne $RemoteUrl) {
  Write-Host "Updating origin from $($origin.Trim()) to $RemoteUrl"
  Run-Git remote set-url origin $RemoteUrl
} else {
  Write-Host "Origin: $RemoteUrl"
}

if (-not $SkipCommit) {
  $status = (& git status --porcelain)
  if ($status) {
    Run-Git add -A
    $staged = (& git diff --cached --name-only)
    if ($staged) {
      Run-Git commit -m $Message
    } else {
      Write-Host "No staged changes to commit."
    }
  } else {
    Write-Host "Working tree is clean. Nothing to commit."
  }
}

if (-not $NoPull) {
  Write-Host "Checking remote branch before push..."
  & git ls-remote --exit-code --heads origin $branch *> $null
  $remoteCheck = $LASTEXITCODE
  if ($remoteCheck -eq 0) {
    Run-Git pull --rebase origin $branch
  } elseif ($remoteCheck -eq 2) {
    Write-Host "Remote branch origin/$branch does not exist yet. Skipping pull."
  } else {
    throw "Could not check origin/$branch. Please verify your GitHub login, network, or proxy settings."
  }
}

Run-Git push -u origin $branch
Write-Host "Done. Your latest code has been pushed." -ForegroundColor Green
