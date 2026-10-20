$ErrorActionPreference = "Stop"

$npmApplication = Get-Command npm.cmd -ErrorAction SilentlyContinue
$npmCommandPath = if ($npmApplication) { $npmApplication.Source } else { $null }

if (-not $npmCommandPath) {
    $defaultNodeDirectory = "C:\Program Files\nodejs"
    $defaultNpmCommand = Join-Path $defaultNodeDirectory "npm.cmd"
    if (Test-Path -LiteralPath $defaultNpmCommand) {
        $npmCommandPath = $defaultNpmCommand
    }
}

if (-not $npmCommandPath) {
    throw "npm.cmd was not found. Install Node.js with npm and add it to PATH."
}

$nodeDirectory = Split-Path -Parent $npmCommandPath
$env:PATH = "$nodeDirectory;$env:PATH"
$env:NODE_OPTIONS = "--openssl-legacy-provider"

& $npmCommandPath start
exit $LASTEXITCODE
