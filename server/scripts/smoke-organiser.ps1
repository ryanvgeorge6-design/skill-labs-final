$ErrorActionPreference = 'Stop'

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body,
        [string]$Token
    )

    $headers = @{}
    if ($Token) {
        $headers['Authorization'] = "Bearer $Token"
    }

    $params = @{
        Uri = $Uri
        Method = $Method
        ContentType = 'application/json'
        Headers = $headers
        UseBasicParsing = $true
    }

    if ($null -ne $Body) {
        $params['Body'] = ($Body | ConvertTo-Json -Compress)
    }

    try {
        $response = Invoke-WebRequest @params
        return [PSCustomObject]@{
            StatusCode = [int]$response.StatusCode
            Body = $response.Content
        }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        $body = $null
        if ($_.Exception.Response) {
            try {
                $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $body = $sr.ReadToEnd()
                $sr.Dispose()
            }
            catch {}
        }

        return [PSCustomObject]@{
            StatusCode = $statusCode
            Body = $body
        }
    }
}

function Test-Result {
    param(
        [string]$Name,
        [int]$Expected,
        [object]$Actual,
        [scriptblock]$Check = $null
    )

    $passed = $false
    $actualStatus = 0
    if ($Actual) { $actualStatus = [int]$Actual.StatusCode }

    if ($actualStatus -eq $Expected) {
        if ($null -ne $Check) {
            $json = $null
            if ($Actual.Body) {
                try {
                    $json = $Actual.Body | ConvertFrom-Json -ErrorAction Stop
                }
                catch {
                    $json = $Actual.Body
                }
            }
            $passed = & $Check $json
        }
        else {
            $passed = $true
        }
    }

    if ($passed) {
        Write-Host "PASS | $Name | expected $Expected | got $actualStatus"
    }
    else {
        Write-Host "FAIL | $Name | expected $Expected | got $actualStatus"
        if ($Actual -and $Actual.Body) {
            Write-Host "BODY: $($Actual.Body)"
        }
    }

    return $passed
}

$base = 'http://localhost:5000'
$userEmail = 'user@test.com'
$organiserEmail = 'organiser@test.com'
$movieId = $null
$showId = $null
$secondOrgEmail = "secondorg_$([guid]::NewGuid().ToString('N').Substring(0,8))@test.com"
$secondToken = $null
$ownerToken = $null
$movieTitle = "Smoke Movie $([DateTime]::Now.ToString('yyyyMMddHHmmss'))"

# 1. GET /api/movies: 200 + body has "movies"
$moviesRes = Invoke-JsonRequest -Method Get -Uri "$base/api/movies"
Test-Result -Name 'GET /api/movies' -Expected 200 -Actual $moviesRes -Check {
    param($json)
    return ($json -and $null -ne $json.movies)
}

# 2. GET /api/movies/not-an-id/shows: 400
$badShowsRes = Invoke-JsonRequest -Method Get -Uri "$base/api/movies/not-an-id/shows"
Test-Result -Name 'GET /api/movies/not-an-id/shows' -Expected 400 -Actual $badShowsRes

# 3. GET /api/movies/<valid unknown ObjectId>/shows: 404
$unknownMovieId = '507f1f77bcf86cd799439011'
$unknownShowsRes = Invoke-JsonRequest -Method Get -Uri "$base/api/movies/$unknownMovieId/shows"
Test-Result -Name 'GET /api/movies/unknown-id/shows' -Expected 404 -Actual $unknownShowsRes

# 4. Login as user@test.com and test organiser movies forbidden
$userLoginRes = Invoke-JsonRequest -Method Post -Uri "$base/api/auth/login" -Body @{ email = $userEmail; password = 'password123' }
$userToken = $null
if ($userLoginRes.StatusCode -eq 200 -and $userLoginRes.Body) {
    try {
        $userJson = $userLoginRes.Body | ConvertFrom-Json -ErrorAction Stop
        if ($userJson.token) { $userToken = $userJson.token }
    }
    catch {}
}
Test-Result -Name 'login user@test.com' -Expected 200 -Actual $userLoginRes -Check {
    param($json)
    return ($json -and $json.token)
}

if (-not $userToken) {
    Write-Host 'FAIL | user token missing; cannot continue organiser checks'
    exit 1
}

$userCreateMovieRes = Invoke-JsonRequest -Method Post -Uri "$base/api/organiser/movies" -Body @{ title = 'User Should Fail'; description = 'bad'; duration = 120; posterUrl = 'https://example.com/poster.jpg' } -Token $userToken
Test-Result -Name 'user POST /api/organiser/movies' -Expected 403 -Actual $userCreateMovieRes

# 5. No token, POST /api/organiser/movies: 401
$noTokenMovieRes = Invoke-JsonRequest -Method Post -Uri "$base/api/organiser/movies" -Body @{ title = 'No Token'; description = 'bad'; duration = 120; posterUrl = 'https://example.com/poster.jpg' }
Test-Result -Name 'no token POST /api/organiser/movies' -Expected 401 -Actual $noTokenMovieRes

# 6. Login as organiser and create valid movie
$organiserLoginRes = Invoke-JsonRequest -Method Post -Uri "$base/api/auth/login" -Body @{ email = $organiserEmail; password = 'password123' }
$ownerToken = $null
if ($organiserLoginRes.StatusCode -eq 200 -and $organiserLoginRes.Body) {
    try {
        $orgJson = $organiserLoginRes.Body | ConvertFrom-Json -ErrorAction Stop
        if ($orgJson.token) { $ownerToken = $orgJson.token }
    }
    catch {}
}
Test-Result -Name 'login organiser@test.com' -Expected 200 -Actual $organiserLoginRes -Check {
    param($json)
    return ($json -and $json.token)
}

if (-not $ownerToken) {
    Write-Host 'FAIL | organiser token missing; cannot continue organiser checks'
    exit 1
}

$createMovieRes = Invoke-JsonRequest -Method Post -Uri "$base/api/organiser/movies" -Body @{ title = $movieTitle; description = 'Created by smoke test'; duration = 120; posterUrl = 'https://example.com/poster.jpg' } -Token $ownerToken
$movieId = $null
if ($createMovieRes.StatusCode -eq 201 -and $createMovieRes.Body) {
    try {
        $movieJson = $createMovieRes.Body | ConvertFrom-Json -ErrorAction Stop
        if ($movieJson.movie -and $movieJson.movie._id) { $movieId = $movieJson.movie._id }
    }
    catch {}
}
Test-Result -Name 'organiser POST /api/organiser/movies' -Expected 201 -Actual $createMovieRes -Check {
    param($json)
    return ($json -and $json.movie -and $json.movie._id)
}

if (-not $movieId) {
    Write-Host 'FAIL | could not determine created movie id'
    exit 1
}

# 7. POST /api/organiser/shows for that movie
$futureTime = (Get-Date).AddDays(1).ToString('yyyy-MM-ddTHH:mm:ss')
$createShowRes = Invoke-JsonRequest -Method Post -Uri "$base/api/organiser/shows" -Body @{ movie = $movieId; screenName = 'Screen 1'; startTime = $futureTime; price = 200 } -Token $ownerToken
$showId = $null
if ($createShowRes.StatusCode -eq 201 -and $createShowRes.Body) {
    try {
        $showJson = $createShowRes.Body | ConvertFrom-Json -ErrorAction Stop
        if ($showJson.show -and $showJson.show._id) { $showId = $showJson.show._id }
    }
    catch {}
}
Test-Result -Name 'organiser POST /api/organiser/shows' -Expected 201 -Actual $createShowRes -Check {
    param($json)
    return ($json -and $json.show -and $json.show._id)
}

if (-not $showId) {
    Write-Host 'FAIL | could not determine created show id'
    exit 1
}

# 8. Show has exactly 80 seats
$seatCount = $null
$seatCheckRes = Invoke-JsonRequest -Method Get -Uri "$base/api/shows/$showId/seats" -Token $ownerToken
if ($seatCheckRes.StatusCode -eq 200 -and $seatCheckRes.Body) {
    try {
        $seatJson = $seatCheckRes.Body | ConvertFrom-Json -ErrorAction Stop
        if ($seatJson.seats) { $seatCount = @($seatJson.seats).Count }
    }
    catch {}
}

if (-not $seatCount) {
    $serverDir = 'C:\projects\movie-booking\server'
    Push-Location $serverDir
    try {
        $nodeOutput = & node "$PSScriptRoot\testhelper.js" count-seats $showId 2>&1
        if ($nodeOutput) {
            $nodeText = ($nodeOutput | Out-String).Trim()
            if ($nodeText -match '^[0-9]+$') {
                $seatCount = [int]$nodeText
            }
            elseif ($nodeText) {
                Write-Host "HELPER STDERR: $nodeText"
            }
        }
    }
    finally {
        Pop-Location
    }
}

$seatCheckActual = [PSCustomObject]@{ StatusCode = if ($seatCount -eq 80) { 200 } else { 500 }; Body = "" }
Test-Result -Name 'show seat count is 80' -Expected 80 -Actual $seatCheckActual -Check {
    param($json)
    return ($seatCount -eq 80)
}

# 9. PUT that show as organiser -> 200
$updateShowRes = Invoke-JsonRequest -Method Put -Uri "$base/api/organiser/shows/$showId" -Body @{ screenName = 'Screen 2'; price = 250 } -Token $ownerToken
Test-Result -Name 'PUT /api/organiser/shows as owner' -Expected 200 -Actual $updateShowRes

# 10. PUT as second organiser -> 403
$secondOrgCreateScript = @'
require("dotenv").config({ quiet: true });
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./src/models/user");
const email = process.env.SECOND_ORG_EMAIL;
const name = "Second Org";
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash("password123", 12),
      role: "organiser"
    });
    console.log(user._id.toString());
    await mongoose.disconnect();
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
'@
$env:SECOND_ORG_EMAIL = $secondOrgEmail
Push-Location 'C:\projects\movie-booking\server'
try {
    $secondOrgId = (& node "$PSScriptRoot\testhelper.js" create-second-org $secondOrgEmail).Trim()
}
finally {
    Pop-Location
}
$secondLoginRes = Invoke-JsonRequest -Method Post -Uri "$base/api/auth/login" -Body @{ email = $secondOrgEmail; password = 'password123' }
$secondToken = $null
if ($secondLoginRes.StatusCode -eq 200 -and $secondLoginRes.Body) {
    try {
        $secondJson = $secondLoginRes.Body | ConvertFrom-Json -ErrorAction Stop
        if ($secondJson.token) { $secondToken = $secondJson.token }
    }
    catch {}
}
Test-Result -Name 'login second organiser' -Expected 200 -Actual $secondLoginRes -Check {
    param($json)
    return ($json -and $json.token)
}

$secondUpdateRes = Invoke-JsonRequest -Method Put -Uri "$base/api/organiser/shows/$showId" -Body @{ price = 999 } -Token $secondToken
Test-Result -Name 'PUT /api/organiser/shows as second organiser' -Expected 403 -Actual $secondUpdateRes

# 11. Invalid show payload -> 400
$invalidShowRes = Invoke-JsonRequest -Method Post -Uri "$base/api/organiser/shows" -Body @{ movie = $movieId; screenName = 'Bad Screen'; startTime = (Get-Date).AddDays(1).ToString('yyyy-MM-ddTHH:mm:ss'); price = -5 } -Token $ownerToken
Test-Result -Name 'POST invalid show payload' -Expected 400 -Actual $invalidShowRes

# 12. Insert confirmed booking then delete show as owner -> 409
$userMeRes = Invoke-JsonRequest -Method Get -Uri "$base/api/auth/me" -Token $userToken
$userId = $null
if ($userMeRes.StatusCode -eq 200 -and $userMeRes.Body) {
    try {
        $meJson = $userMeRes.Body | ConvertFrom-Json -ErrorAction Stop
        if ($meJson.user -and $meJson.user.id) { $userId = $meJson.user.id }
    }
    catch {}
}
if (-not $userId) {
    Write-Host 'FAIL | could not resolve user id for temporary booking'
    exit 1
}

$env:BOOKING_USER_ID = $userId
$env:BOOKING_SHOW_ID = $showId
$env:BOOKING_AMOUNT = '200'
Push-Location 'C:\projects\movie-booking\server'
try {
    $confirmedBookingId = (& node "$PSScriptRoot\testhelper.js" create-booking).Trim()
}
finally {
    Pop-Location
}
$deleteWithConfirmedRes = Invoke-JsonRequest -Method Delete -Uri "$base/api/organiser/shows/$showId" -Token $ownerToken
Test-Result -Name 'DELETE show with confirmed booking' -Expected 409 -Actual $deleteWithConfirmedRes

# 13. Dashboard as owner; add pending booking and confirm unchanged
$dashboardRes = Invoke-JsonRequest -Method Get -Uri "$base/api/organiser/dashboard" -Token $ownerToken
$dashboardBefore = $null
if ($dashboardRes.Body) {
    try { $dashboardBefore = $dashboardRes.Body | ConvertFrom-Json -ErrorAction Stop } catch {}
}
Test-Result -Name 'GET /api/organiser/dashboard' -Expected 200 -Actual $dashboardRes -Check {
    param($json)
    if (-not $json) { return $false }
    return ($json.revenue -ge 200) -and ($json.ticketsSold -ge 1)
}

$env:BOOKING_PENDING_USER_ID = $userId
$env:BOOKING_PENDING_SHOW_ID = $showId
$env:BOOKING_PENDING_AMOUNT = '150'
Push-Location 'C:\projects\movie-booking\server'
try {
    $pendingBookingId = (& node "$PSScriptRoot\testhelper.js" create-pending-booking).Trim()
}
finally {
    Pop-Location
}
$dashboardAfterPendingRes = Invoke-JsonRequest -Method Get -Uri "$base/api/organiser/dashboard" -Token $ownerToken
$dashboardAfterPending = $null
if ($dashboardAfterPendingRes.Body) {
    try { $dashboardAfterPending = $dashboardAfterPendingRes.Body | ConvertFrom-Json -ErrorAction Stop } catch {}
}
Test-Result -Name 'pending booking does not change dashboard' -Expected 200 -Actual $dashboardAfterPendingRes -Check {
    param($json)
    if (-not $json) { return $false }
    if (-not $dashboardBefore) { return $false }
    return ($json.revenue -eq $dashboardBefore.revenue) -and ($json.ticketsSold -eq $dashboardBefore.ticketsSold)
}

# 14. Cleanup: delete bookings, delete show, delete second organiser and movie
$env:BOOKING_SHOW_ID = $showId
Push-Location 'C:\projects\movie-booking\server'
try {
    & node "$PSScriptRoot\testhelper.js" delete-bookings $showId | Out-Null
}
finally {
    Pop-Location
}

$deleteShowAfterCleanupRes = Invoke-JsonRequest -Method Delete -Uri "$base/api/organiser/shows/$showId" -Token $ownerToken
Test-Result -Name 'DELETE show after cleanup' -Expected 200 -Actual $deleteShowAfterCleanupRes

Push-Location 'C:\projects\movie-booking\server'
try {
    $seatAfterDelete = (& node "$PSScriptRoot\testhelper.js" count-seats $showId).Trim()
}
finally {
    Pop-Location
}
$seatAfterDeleteValue = [int]$seatAfterDelete
Test-Result -Name 'show seats removed after delete' -Expected 0 -Actual ([PSCustomObject]@{ StatusCode = if ($seatAfterDeleteValue -eq 0) { 200 } else { 500 }; Body = '' }) -Check {
    param($json)
    return ($seatAfterDeleteValue -eq 0)
}

$deleteMovieRes = Invoke-JsonRequest -Method Delete -Uri "$base/api/organiser/movies/$movieId" -Token $ownerToken
Test-Result -Name 'DELETE test movie' -Expected 200 -Actual $deleteMovieRes

$env:SECOND_ORG_EMAIL = $secondOrgEmail
Push-Location 'C:\projects\movie-booking\server'
try {
    & node "$PSScriptRoot\testhelper.js" delete-second-org $secondOrgEmail | Out-Null
}
finally {
    Pop-Location
}

Write-Host 'ORGANISER SMOKE SCRIPT COMPLETE'
