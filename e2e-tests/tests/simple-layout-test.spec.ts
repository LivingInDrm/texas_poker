import { test, expect } from '@playwright/test';

// 生成随机用户名避免重复
const generateRandomUser = () => ({
  username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  password: 'testpassword123'
});

test.describe('修复后的页面布局截图测试', () => {
  test('修复后的登录页面布局', async ({ page }) => {
    // 访问登录页面
    await page.goto('/login');
    
    // 等待页面完全加载
    await expect(page.locator('h1')).toContainText('德州扑克');
    await page.waitForLoadState('networkidle');
    
    // 截图修复后的登录页面
    await page.screenshot({
      path: 'test-results/fixed-login-page-default.png',
      fullPage: true
    });
    
    // 切换到注册模式并截图
    await page.click('text=没有账户？立即注册');
    await expect(page.locator('h2')).toContainText('注册');
    
    await page.screenshot({
      path: 'test-results/fixed-login-page-register-mode.png',
      fullPage: true
    });
  });

  test('修复后的大厅页面布局', async ({ page }) => {
    // 先注册一个用户
    const user = generateRandomUser();
    
    await page.goto('/login');
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // 等待跳转到大厅页面
    await expect(page).toHaveURL('/lobby');
    await expect(page.locator('h1')).toContainText('德州扑克');
    await page.waitForLoadState('networkidle');
    
    // 截图修复后的大厅页面
    await page.screenshot({
      path: 'test-results/fixed-lobby-page-default.png',
      fullPage: true
    });
  });

  test('修复后的移动端响应式设计', async ({ page }) => {
    const user = generateRandomUser();
    
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 测试登录页面
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('德州扑克');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: 'test-results/fixed-login-page-mobile.png',
      fullPage: true
    });
    
    // 注册用户并测试大厅页面
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/lobby');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: 'test-results/fixed-lobby-page-mobile.png',
      fullPage: true
    });
  });
});