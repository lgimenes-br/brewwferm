import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Log console messages
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err.message}"))
        
        # Open local HTML file
        import os
        file_url = f"file://{os.path.abspath('public/7inch-launcher.html')}"
        await page.goto(file_url)
        
        # Wait a bit
        await page.wait_for_timeout(3000)
        
        await page.screenshot(path="screenshot_py.png")
        await browser.close()
        print("Screenshot saved to screenshot_py.png")

asyncio.run(main())
