/**
 * 最简 UAT：启动浏览器 → 用户手动登录 → 脚本自动截图+验证
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const WEB_URL = process.env.WEB_URL || 'https://procurement-platform-rosy.vercel.app'
const DIR = '/tmp/uat-screenshots'
fs.mkdirSync(DIR, { recursive: true })

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1440,900', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const ss = async (n) => {
    await page.screenshot({ path: path.join(DIR, `${n}.png`), fullPage: true })
    console.log(`📸 ${n}.png`)
  }

  // 打开登录页
  console.log('🔗 打开登录页...')
  await page.goto(WEB_URL, { waitUntil: 'networkidle', timeout: 30000 })
  await ss('01-login')
  console.log('✅ 登录页已加载，请手动完成登录（点飞书登录 → 扫码 → 授权）')
  console.log('⏳ 等待登录完成...')

  // 等待 URL 不再包含 feishu.cn 且不再是登录页
  try {
    await page.waitForFunction(() => {
      return !document.querySelector('button')?.textContent?.includes('飞书登录')
    }, { timeout: 120000 })
    console.log('✅ 检测到登录完成')
  } catch {
    console.log('⚠️ 超时，继续截图当前状态')
  }

  await page.waitForTimeout(3000)
  await ss('02-dashboard')

  // 检查页面
  const text = await page.locator('body').innerText().catch(() => '')
  console.log(`\n📊 Dashboard 内容: ${text.substring(0, 200)}`)

  // 项目列表
  console.log('\n📋 导航到项目列表...')
  try {
    // 尝试点击菜单
    const menu = page.locator('.ant-menu-item').filter({ hasText: /项目/ }).first()
    if (await menu.isVisible({ timeout: 3000 })) {
      await menu.click()
    } else {
      await page.goto(`${WEB_URL}/projects`, { waitUntil: 'networkidle', timeout: 15000 })
    }
  } catch {
    await page.goto(`${WEB_URL}/projects`, { waitUntil: 'networkidle', timeout: 15000 })
  }
  await page.waitForTimeout(3000)
  await ss('03-projects')
  const rows = await page.locator('.ant-table-row').count()
  console.log(`   项目数: ${rows}`)

  // 项目详情
  if (rows > 0) {
    console.log('\n📅 点击第一个项目...')
    await page.locator('.ant-table-row').first().click()
    await page.waitForTimeout(3000)
    await ss('04-detail')
  }

  // 创建项目
  console.log('\n➕ 创建项目...')
  try {
    const btn = page.locator('button').filter({ hasText: /创建|新建/ }).first()
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click()
      await page.waitForTimeout(1500)
      await ss('05-create-form')
      // 关闭
      await page.locator('.ant-modal-close').first().click().catch(() => {})
    }
  } catch {}

  // 问题管理
  console.log('\n🐛 问题管理...')
  try {
    const menu = page.locator('.ant-menu-item').filter({ hasText: /问题/ }).first()
    if (await menu.isVisible({ timeout: 3000 })) {
      await menu.click()
    } else {
      await page.goto(`${WEB_URL}/issues`, { waitUntil: 'networkidle', timeout: 15000 })
    }
  } catch {
    await page.goto(`${WEB_URL}/issues`, { waitUntil: 'networkidle', timeout: 15000 })
  }
  await page.waitForTimeout(3000)
  await ss('06-issues')

  await ss('99-final')
  console.log('\n✅ UAT 完成！截图:', DIR)

  await browser.close()
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })
