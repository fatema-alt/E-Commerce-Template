Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Lenovo\.gemini\antigravity\brain\625a8821-beeb-4a76-a874-ab29f90ae5cb\.user_uploaded\media_1793618130255_712f9aab.jpg"
$outDir = "d:\Office - Projects\commerce-suite\apps\storefront\public\brand\categories"

if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$bmp = New-Object System.Drawing.Bitmap($srcPath)

# Exact bounding boxes of the 6 pristine tiles from 1024x576 image:
$slices = @(
    @{ Name = "electronics.jpg"; Rect = New-Object System.Drawing.Rectangle(33, 114, 612, 274) },
    @{ Name = "lifestyle.jpg"; Rect = New-Object System.Drawing.Rectangle(655, 114, 336, 132) },
    @{ Name = "spices.jpg"; Rect = New-Object System.Drawing.Rectangle(655, 256, 336, 132) },
    @{ Name = "kids-toys.jpg"; Rect = New-Object System.Drawing.Rectangle(33, 398, 301, 148) },
    @{ Name = "kids-books.jpg"; Rect = New-Object System.Drawing.Rectangle(344, 398, 301, 148) },
    @{ Name = "groceries.jpg"; Rect = New-Object System.Drawing.Rectangle(655, 398, 336, 148) }
)

foreach ($slice in $slices) {
    $target = New-Object System.Drawing.Bitmap($slice.Rect.Width, $slice.Rect.Height)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $slice.Rect.Width, $slice.Rect.Height)
    $g.DrawImage($bmp, $destRect, $slice.Rect, [System.Drawing.GraphicsUnit]::Pixel)
    
    $outPath = Join-Path $outDir $slice.Name
    $target.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $g.Dispose()
    $target.Dispose()
    Write-Output "Extracted pristine: $outPath ($($slice.Rect.Width)x$($slice.Rect.Height))"
}

$bmp.Dispose()
Write-Output "All 6 pristine tiles extracted successfully!"
