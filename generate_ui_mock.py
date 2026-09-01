import asyncio
from playwright.async_api import async_playwright
import os
import cv2
import numpy as np

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        file_url = f"file://{os.path.abspath('public/3.5inch-launcher.html')}"
        await page.goto(file_url)
        await page.wait_for_timeout(3000)
        await page.screenshot(path="mock_ui.png")
        await browser.close()
        
        # Now convert to RGB565
        img = cv2.imread("mock_ui.png")
        # Center crop or resize to 480x320
        # The browser screenshot might be 800x600. Let's crop the exact 480x320 center.
        h, w = img.shape[:2]
        start_x = w//2 - 240
        start_y = h//2 - 160
        cropped = img[start_y:start_y+320, start_x:start_x+480]
        
        # BGR to RGB565
        r = (cropped[:, :, 2] >> 3).astype(np.uint16)
        g = (cropped[:, :, 1] >> 2).astype(np.uint16)
        b = (cropped[:, :, 0] >> 3).astype(np.uint16)
        rgb565 = (r << 11) | (g << 5) | b
        
        # Save to .h file
        header_path = "/Users/libra/Desktop/Beer/ESP8266/_libra controler/Teste_display/ui_mock.h"
        with open(header_path, "w") as f:
            f.write("const uint16_t ui_mock[153600] PROGMEM = {\n")
            # Flatten and write
            flat = rgb565.flatten()
            for i, val in enumerate(flat):
                f.write(f"0x{val:04X},")
                if (i+1) % 16 == 0:
                    f.write("\n")
            f.write("};\n")
        print("Generated ui_mock.h")

asyncio.run(main())
