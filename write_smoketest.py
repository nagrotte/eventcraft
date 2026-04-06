script = r"""
param(
    [ValidateSet("Lambda","ApiGw","Frontend","All")]
    [string]$Gate = "All"
)

$ApiBase  = "https://k08tavl4m4.execute-api.us-east-1.amazonaws.com"
$FrontEnd = "https://eventcraft.irotte.com"
$EventId  = "evt_eb99ec9787cb4d05a167dc8122dfd25a"
$Slug     = "srirama-tatvamu"
$TestRsvpId = "REPLACE_WITH_REAL_RSVP_ID"

$script:pass  = 0
$script:fail  = 0
$script:total = 0

function Test-Http {
    param(
        [string]$Label,
        [string]$Uri,
        [string]$Method = "GET",
        [int]$ExpectStatus = 200,
        [string]$Body = ""
    )
    $script:total++
    try {
        $params = @{
            UseBasicParsing = $true
            Uri             = $Uri
            Method          = $Method
            ErrorAction     = "Stop"
        }
        if ($Body) {
            $params.Body        = $Body
            $params.ContentType = "application/json"
        }
        $resp = Invoke-WebRequest @params
        $code = $resp.StatusCode
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (-not $code) { $code = 0 }
    }
    if ($code -eq $ExpectStatus) {
        Write-Host "  [PASS] $Label (HTTP $code)" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] $Label -- expected $ExpectStatus, got $code" -ForegroundColor Red
        $script:fail++
    }
}

function Show-Gate {
    param([string]$Name)
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host "  GATE: $Name" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Cyan
}

function Show-Summary {
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor White
    if ($script:fail -eq 0) {
        Write-Host "  RESULT: ALL $($script:total) TESTS PASSED" -ForegroundColor Green
    } else {
        Write-Host "  RESULT: $($script:fail)/$($script:total) FAILED -- DO NOT PROCEED" -ForegroundColor Red
        Write-Host "  Run ROLLBACK.md commands immediately if live traffic affected." -ForegroundColor Yellow
    }
    Write-Host "----------------------------------------" -ForegroundColor White
}

function Run-LambdaGate {
    Show-Gate "1 -- LAMBDA DEPLOY"

    Test-Http -Label "GET slug -> public event" `
        -Uri "$ApiBase/events/slug/$Slug/public"

    Test-Http -Label "GET eventId -> public event" `
        -Uri "$ApiBase/events/$EventId/public"

    $rsvpBody = '{"name":"Smoke Test","email":"smoketest@eventcraft.test","response":"yes","guestCount":2}'
    Test-Http -Label "POST rsvp with guestCount=2" `
        -Uri "$ApiBase/events/$EventId/rsvp" `
        -Method "POST" `
        -Body $rsvpBody `
        -ExpectStatus 200

    $script:total++
    try {
        $r    = Invoke-WebRequest -UseBasicParsing -Uri "$ApiBase/events/$EventId/rsvp" -Method GET
        $json = $r.Content | ConvertFrom-Json
        $items = $json.data
        $smokeRsvp = $items | Where-Object { $_.email -eq "smoketest@eventcraft.test" }
        if ($smokeRsvp -and $smokeRsvp.guestCount -ne $null) {
            Write-Host "  [PASS] GET rsvps -- guestCount field present" -ForegroundColor Green
            $script:pass++
            Write-Host "  [INFO] Smoke RSVP rsvpId: $($smokeRsvp.rsvpId)" -ForegroundColor Gray
            Write-Host "  [INFO] Set TestRsvpId=$($smokeRsvp.rsvpId) in script for ApiGw gate" -ForegroundColor Yellow
        } else {
            Write-Host "  [FAIL] GET rsvps -- guestCount missing or smoke rsvp not found" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "  [FAIL] GET rsvps request failed: $_" -ForegroundColor Red
        $script:fail++
    }
}

function Run-ApiGwGate {
    Show-Gate "2 -- API GATEWAY (DELETE route)"

    if ($TestRsvpId -eq "REPLACE_WITH_REAL_RSVP_ID") {
        Write-Host "  [SKIP] Set TestRsvpId at top of script first (from Lambda gate output)" -ForegroundColor Yellow
    } else {
        Test-Http -Label "DELETE rsvp -> 204" `
            -Uri "$ApiBase/events/$EventId/rsvp/$TestRsvpId" `
            -Method "DELETE" `
            -ExpectStatus 204

        $script:total++
        try {
            $r     = Invoke-WebRequest -UseBasicParsing -Uri "$ApiBase/events/$EventId/rsvp" -Method GET
            $json  = $r.Content | ConvertFrom-Json
            $still = $json.data | Where-Object { $_.rsvpId -eq $TestRsvpId }
            if (-not $still) {
                Write-Host "  [PASS] Deleted rsvp no longer in list" -ForegroundColor Green
                $script:pass++
            } else {
                Write-Host "  [FAIL] Deleted rsvp still present in list" -ForegroundColor Red
                $script:fail++
            }
        } catch {
            Write-Host "  [FAIL] GET rsvps after delete failed: $_" -ForegroundColor Red
            $script:fail++
        }
    }

    Test-Http -Label "GET slug still works after API GW change" `
        -Uri "$ApiBase/events/slug/$Slug/public"

    Test-Http -Label "GET eventId still works after API GW change" `
        -Uri "$ApiBase/events/$EventId/public"
}

function Run-FrontendGate {
    Show-Gate "3 -- FRONTEND (Vercel)"

    Test-Http -Label "Homepage loads" -Uri "$FrontEnd"
    Test-Http -Label "Login page reachable" -Uri "$FrontEnd/login"
    Test-Http -Label "Microsite /e/$Slug loads" -Uri "$FrontEnd/e/$Slug"

    Write-Host ""
    Write-Host "  [MANUAL] Open browser and verify:" -ForegroundColor Yellow
    Write-Host "    12. Login -> Dashboard RSVPs show guest count pill + total guests" -ForegroundColor Yellow
    Write-Host "    13. Dashboard -> Delete button removes RSVP row" -ForegroundColor Yellow
    Write-Host "    14. Microsite -> Submit RSVP twice with same email = no duplicate" -ForegroundColor Yellow
    Write-Host "        URL: $FrontEnd/e/$Slug" -ForegroundColor Gray
}

Write-Host ""
Write-Host "EventCraft Smoke Tests -- $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White

switch ($Gate) {
    "Lambda"   { Run-LambdaGate }
    "ApiGw"    { Run-ApiGwGate }
    "Frontend" { Run-FrontendGate }
    "All"      { Run-LambdaGate; Run-ApiGwGate; Run-FrontendGate }
}

Show-Summary
""".strip()

with open(r"D:\Projects\eventcraft\Invoke-SmokeTests.ps1", "w", encoding="ascii") as f:
    f.write(script)

print("Written OK")
