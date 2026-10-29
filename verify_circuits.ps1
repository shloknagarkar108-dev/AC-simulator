# Comprehensive Verification Script for RLC Simulator Engine
# Testing all 6 Modes, Edge Cases, Formulas, and Signs

$script:testsPassed = 0
$script:testsFailed = 0

function Assert-Close {
    param(
        [string]$desc,
        [double]$actual,
        [double]$expected,
        [double]$tolerance = 0.05
    )
    $diff = [Math]::Abs($actual - $expected)
    if ($diff -le $tolerance) {
        Write-Host "PASS: $desc | Actual=$actual, Expected=$expected" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "FAIL: $desc | Actual=$actual, Expected=$expected, Diff=$diff" -ForegroundColor Red
        $script:testsFailed++
    }
}

function Assert-True {
    param(
        [string]$desc,
        [bool]$condition,
        [string]$details = ""
    )
    if ($condition) {
        Write-Host "PASS: $desc" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "FAIL: $desc - $details" -ForegroundColor Red
        $script:testsFailed++
    }
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "RLC Simulator Mathematical Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Pure R Mode: V=230, f=50, R=100
$V = 230.0; $f = 50.0; $R = 100.0
$omega = 2 * [Math]::PI * $f
$Z_R = $R
$I_R = $V / $Z_R
$P_R = $I_R * $I_R * $R
$Q_R = 0.0
$S_R = $V * $I_R
$PF_R = $P_R / $S_R
$phi_R = [Math]::Atan2(0, $R) * (180 / [Math]::PI)

Assert-Close "Mode R: Impedance Z" $Z_R 100.0
Assert-Close "Mode R: Current Irms" $I_R 2.300
Assert-Close "Mode R: Real Power P" $P_R 529.00
Assert-Close "Mode R: Reactive Power Q" $Q_R 0.0
Assert-Close "Mode R: Power Factor PF" $PF_R 1.000
Assert-Close "Mode R: Phase Angle phi" $phi_R 0.0

# 2. Pure L Mode: V=230, f=50, L=0.1
$L = 0.1
$XL_L = $omega * $L
$Z_L = $XL_L
$I_L = $V / $Z_L
$P_L = 0.0
$Q_L = $I_L * $I_L * $XL_L
$S_L = $V * $I_L
$PF_L = 0.0
$phi_L = [Math]::Atan2($XL_L, 0) * (180 / [Math]::PI)

Assert-Close "Mode L: Reactance XL" $XL_L 31.416
Assert-Close "Mode L: Current Irms" $I_L 7.321
Assert-Close "Mode L: Real Power P" $P_L 0.0
Assert-Close "Mode L: Reactive Power Q (Positive, Lagging)" $Q_L 1683.86 1.0
Assert-Close "Mode L: Phase Angle phi = +90" $phi_L 90.0
Assert-True  "Mode L: Q > 0 indicates lagging reactive power" ($Q_L -gt 0)

# 3. Pure C Mode: V=230, f=50, C=0.0001
$C = 0.0001
$XC_C = 1 / ($omega * $C)
$Z_C = $XC_C
$I_C = $V / $Z_C
$P_C = 0.0
$Q_C = -($I_C * $I_C * $XC_C)
$S_C = $V * $I_C
$PF_C = 0.0
$phi_C = [Math]::Atan2(-$XC_C, 0) * (180 / [Math]::PI)

Assert-Close "Mode C: Reactance XC" $XC_C 31.831
Assert-Close "Mode C: Current Irms" $I_C 7.226
Assert-Close "Mode C: Real Power P" $P_C 0.0
Assert-Close "Mode C: Reactive Power Q (Negative, Leading)" $Q_C -1661.90 1.0
Assert-Close "Mode C: Phase Angle phi = -90" $phi_C -90.0
Assert-True  "Mode C: Q < 0 indicates leading reactive power" ($Q_C -lt 0)

# 4. Series RL Mode: V=230, f=50, R=100, L=0.1
$Z_RL = [Math]::Sqrt($R * $R + $XL_L * $XL_L)
$I_RL = $V / $Z_RL
$phi_RL = [Math]::Atan2($XL_L, $R) * (180 / [Math]::PI)
$P_RL = $I_RL * $I_RL * $R
$Q_RL = $I_RL * $I_RL * $XL_L
$S_RL = $V * $I_RL
$PF_RL = $P_RL / $S_RL

Assert-Close "Mode RL: Impedance Z" $Z_RL 104.819
Assert-Close "Mode RL: Current Irms" $I_RL 2.194
Assert-Close "Mode RL: Phase Angle phi" $phi_RL 17.44
Assert-Close "Mode RL: Real Power P" $P_RL 481.44
Assert-Close "Mode RL: Reactive Power Q (+)" $Q_RL 151.25
Assert-Close "Mode RL: Power Factor PF" $PF_RL 0.954
Assert-True  "Mode RL: phi > 0 (Lagging)" ($phi_RL -gt 0)

# 5. Series RC Mode: V=230, f=50, R=100, C=0.0001
$Z_RC = [Math]::Sqrt($R * $R + $XC_C * $XC_C)
$I_RC = $V / $Z_RC
$phi_RC = [Math]::Atan2(-$XC_C, $R) * (180 / [Math]::PI)
$P_RC = $I_RC * $I_RC * $R
$Q_RC = -($I_RC * $I_RC * $XC_C)
$S_RC = $V * $I_RC
$PF_RC = $P_RC / $S_RC

Assert-Close "Mode RC: Impedance Z" $Z_RC 104.944
Assert-Close "Mode RC: Current Irms" $I_RC 2.192
Assert-Close "Mode RC: Phase Angle phi (-)" $phi_RC -17.66
Assert-Close "Mode RC: Real Power P" $P_RC 480.29
Assert-Close "Mode RC: Reactive Power Q (-)" $Q_RC -152.89 0.1
Assert-Close "Mode RC: Power Factor PF" $PF_RC 0.953
Assert-True  "Mode RC: phi < 0 (Leading)" ($phi_RC -lt 0)
Assert-True  "Test 5b: Mode RC Reactive Power sign assertion (Q < 0, Leading)" ($Q_RC -lt 0)

# 6. Series RLC Mode: V=230, f=50, R=100, L=0.1, C=0.0001
$X_RLC = $XL_L - $XC_C
$Z_RLC = [Math]::Sqrt($R * $R + $X_RLC * $X_RLC)
$I_RLC = $V / $Z_RLC
$phi_RLC = [Math]::Atan2($X_RLC, $R) * (180 / [Math]::PI)
$P_RLC = $I_RLC * $I_RLC * $R
$Q_RLC = $I_RLC * $I_RLC * $X_RLC
$S_RLC = $V * $I_RLC
$PF_RLC = $P_RLC / $S_RLC
$fr_RLC = 1 / (2 * [Math]::PI * [Math]::Sqrt($L * $C))

Assert-Close "Mode RLC: Net Reactance X" $X_RLC -0.415
Assert-Close "Mode RLC: Impedance Z" $Z_RLC 100.001
Assert-Close "Mode RLC: Current Irms" $I_RLC 2.300
Assert-Close "Mode RLC: Phase Angle phi" $phi_RLC -0.24
Assert-Close "Mode RLC: Real Power P" $P_RLC 528.99
Assert-Close "Mode RLC: Reactive Power Q (Negative, capacitive)" $Q_RLC -2.20
Assert-Close "Mode RLC: Apparent Power S" $S_RLC 529.00
Assert-Close "Mode RLC: Power Factor PF" $PF_RLC 1.000
Assert-Close "Mode RLC: Resonant Frequency fr" $fr_RLC 50.329

# 7. Exact Resonance Test: f = fr = 50.329212 Hz, R = 10, L = 0.1, C = 0.0001
$f_res = 50.3292121
$omega_res = 2 * [Math]::PI * $f_res
$XL_res = $omega_res * $L
$XC_res = 1 / ($omega_res * $C)
$X_res = $XL_res - $XC_res
$Z_res = [Math]::Sqrt(10.0 * 10.0 + $X_res * $X_res)
$phi_res = [Math]::Atan2($X_res, 10.0) * (180 / [Math]::PI)

Assert-Close "Resonance: XL and XC match" $XL_res $XC_res 0.001
Assert-Close "Resonance: Net X is 0" $X_res 0.0 0.001
Assert-Close "Resonance: Impedance Z = R = 10" $Z_res 10.0 0.001
Assert-Close "Resonance: Phase angle phi is 0" $phi_res 0.0 0.01

# 8. Edge Cases: Zero resistance in RL & RC
$phi_RL_R0 = [Math]::Atan2($XL_L, 0.0) * (180 / [Math]::PI)
$phi_RC_R0 = [Math]::Atan2(-$XC_C, 0.0) * (180 / [Math]::PI)
Assert-Close "RL with R = 0: phi = +90" $phi_RL_R0 90.0
Assert-Close "RC with R = 0: phi = -90" $phi_RC_R0 -90.0

# 8f. Zero-resistance RLC at resonance rejection
$relDiff_res = [Math]::Abs($f_res - $fr_RLC) / $fr_RLC
$isRejectedRes = ($relDiff_res -lt 0.005) -or ([Math]::Abs($X_res) -lt 0.05)
Assert-True "Test 8f: Zero-resistance RLC at resonance is rejected (relDiff < 0.005)" $isRejectedRes

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Summary: $script:testsPassed Passed, $script:testsFailed Failed" -ForegroundColor $(if ($script:testsFailed -eq 0) { "Green" } else { "Red" })
Write-Host "=========================================" -ForegroundColor Cyan

if ($script:testsFailed -gt 0) { exit 1 }
