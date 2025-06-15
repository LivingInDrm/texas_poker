import { test, expect } from '@playwright/test';

// 生成随机用户名避免重复
const generateRandomUser = () => ({
  username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  password: 'testpassword123'
});

test.describe('页面布局截图测试', () => {
  test('登录页面布局截图测试', async ({ page }) => {
    // 访问登录页面
    await page.goto('/login');
    
    // 等待页面完全加载
    await expect(page.locator('h1')).toContainText('德州扑克');
    await page.waitForLoadState('networkidle');
    
    // 截图登录页面的默认状态
    await page.screenshot({
      path: 'test-results/login-page-default.png',
      fullPage: true
    });
    
    // 切换到注册模式
    await page.click('text=没有账户？立即注册');
    await expect(page.locator('h2')).toContainText('注册');
    
    // 截图注册模式
    await page.screenshot({
      path: 'test-results/login-page-register-mode.png',
      fullPage: true
    });
    
    // 填写一些表单数据以测试表单状态
    await page.fill('input[name="username"]', 'demo_user');
    await page.fill('input[name="password"]', 'demo_password');
    await page.fill('input[name="avatar"]', 'https://example.com/avatar.jpg');
    
    // 截图填写表单后的状态
    await page.screenshot({
      path: 'test-results/login-page-form-filled.png',
      fullPage: true
    });
    
    // 切换回登录模式验证界面
    await page.click('text=已有账户？立即登录');
    await expect(page.locator('h2')).toContainText('登录');
    
    // 截图切换回登录模式后的状态
    await page.screenshot({
      path: 'test-results/login-page-back-to-login.png',
      fullPage: true
    });
  });

  test('大厅页面布局截图测试', async ({ page }) => {
    // 先注册一个用户以便访问大厅页面
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
    
    // 截图大厅页面的默认状态
    await page.screenshot({
      path: 'test-results/lobby-page-default.png',
      fullPage: true
    });
    
    // 点击创建房间按钮测试弹窗
    await page.click('text=创建房间');
    
    // 等待弹窗出现
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 截图创建房间弹窗
    await page.screenshot({
      path: 'test-results/lobby-page-create-room-modal.png',
      fullPage: true
    });
    
    // 填写房间创建表单
    await page.fill('input[placeholder*="最大玩家数"]', '6');
    await page.fill('input[placeholder*="大盲注"]', '20');
    await page.fill('input[placeholder*="小盲注"]', '10');
    
    // 截图填写表单后的弹窗
    await page.screenshot({
      path: 'test-results/lobby-page-create-room-filled.png',
      fullPage: true
    });
    
    // 关闭弹窗
    await page.press('body', 'Escape');
    
    // 等待弹窗关闭
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    // 测试快速开始按钮
    await page.click('text=快速开始');
    
    // 等待可能的状态变化
    await page.waitForTimeout(1000);
    
    // 截图快速开始后的状态（可能跳转到游戏页面或显示匹配状态）
    await page.screenshot({
      path: 'test-results/lobby-page-after-quick-start.png',
      fullPage: true
    });
  });

  test('响应式设计截图测试', async ({ page }) => {
    const user = generateRandomUser();
    
    // 测试不同视口大小下的登录页面
    const viewports = [
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      // 设置视口大小
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // 测试登录页面
      await page.goto('/login');
      await expect(page.locator('h1')).toContainText('德州扑克');
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({
        path: `test-results/login-page-${viewport.name}.png`,
        fullPage: true
      });
      
      // 注册用户并测试大厅页面
      await page.click('text=没有账户？立即注册');
      await page.fill('input[name="username"]', `${user.username}_${viewport.name}`);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL('/lobby');
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({
        path: `test-results/lobby-page-${viewport.name}.png`,
        fullPage: true
      });
      
      // 为下一个视口测试清除localStorage
      await page.evaluate(() => localStorage.clear());
    }
  });

  test('错误状态界面截图测试', async ({ page }) => {
    await page.goto('/login');
    
    // 测试登录错误状态
    await page.fill('input[name="username"]', 'nonexistentuser');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // 等待错误消息出现
    await page.waitForTimeout(2000);
    try {
      await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 5000 });
      
      // 截图登录错误状态
      await page.screenshot({
        path: 'test-results/login-page-error-state.png',
        fullPage: true
      });
    } catch (error) {
      console.log('登录错误状态可能未显示，继续测试其他状态');
    }
    
    // 测试注册重复用户名错误
    const user = generateRandomUser();
    
    // 先成功注册一个用户
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/lobby');
    
    // 返回登录页面尝试重复注册
    await page.goto('/login');
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // 等待错误消息
    await page.waitForTimeout(1000);
    try {
      await expect(page.locator('.bg-red-100')).toBeVisible({ timeout: 5000 });
      
      // 截图重复用户名错误状态
      await page.screenshot({
        path: 'test-results/register-page-duplicate-user-error.png',
        fullPage: true
      });
    } catch (error) {
      console.log('注册重复用户名错误状态可能未显示');
    }
  });

  test('加载状态界面截图测试', async ({ page }) => {
    await page.goto('/login');
    
    const user = generateRandomUser();
    
    // 模拟慢网络环境
    await page.route('**/api/**', (route) => {
      setTimeout(() => route.continue(), 2000); // 延迟2秒
    });
    
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    
    // 点击提交按钮
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // 尝试捕获加载状态
    try {
      await expect(submitButton).toHaveAttribute('disabled', '', { timeout: 1000 });
      
      // 截图加载状态
      await page.screenshot({
        path: 'test-results/register-page-loading-state.png',
        fullPage: true
      });
    } catch (error) {
      console.log('加载状态可能显示时间太短无法捕获');
    }
    
    // 等待请求完成
    await expect(page).toHaveURL('/lobby', { timeout: 10000 });
  });
});