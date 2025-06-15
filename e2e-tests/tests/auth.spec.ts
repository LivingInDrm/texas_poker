import { test, expect } from '@playwright/test';

// 生成随机用户名避免重复
const generateRandomUser = () => ({
  username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  password: 'testpassword123'
});

test.describe('用户认证流程', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前访问登录页面
    await page.goto('/login');
  });

  test('注册新用户流程', async ({ page }) => {
    const user = generateRandomUser();
    
    // 1. 确认在登录页面
    await expect(page.locator('h1')).toContainText('德州扑克');
    await expect(page.locator('h2')).toContainText('登录');
    
    // 2. 切换到注册模式
    await page.click('text=没有账户？立即注册');
    await expect(page.locator('h2')).toContainText('注册');
    
    // 3. 填写注册表单
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    
    // 4. 提交注册表单
    await page.click('button[type="submit"]');
    
    // 5. 验证注册成功，跳转到大厅页面
    await expect(page).toHaveURL('/lobby');
    await expect(page.locator('h1')).toContainText('德州扑克');
    
    // 6. 验证用户信息显示正确
    await expect(page.locator('text=' + user.username)).toBeVisible();
  });

  test('登录已存在用户流程', async ({ page }) => {
    // 先注册一个用户
    const user = generateRandomUser();
    
    // 注册流程
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // 等待跳转到大厅页面后登出
    await expect(page).toHaveURL('/lobby');
    
    // 登出（通过直接访问登录页面或清除localStorage）
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // 验证已在登录页面
    await expect(page.locator('h2')).toContainText('登录');
    
    // 1. 填写登录表单
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    
    // 2. 提交登录表单
    await page.click('button[type="submit"]');
    
    // 3. 验证登录成功，跳转到大厅页面
    await expect(page).toHaveURL('/lobby');
    await expect(page.locator('h1')).toContainText('德州扑克');
    
    // 4. 验证用户信息显示正确
    await expect(page.locator('text=' + user.username)).toBeVisible();
  });

  test('注册表单验证', async ({ page }) => {
    // 切换到注册模式
    await page.click('text=没有账户？立即注册');
    
    // 1. 空用户名提交
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // HTML5 验证阻止提交，用户名字段应该有错误提示
    const usernameField = page.locator('input[name="username"]');
    await expect(usernameField).toHaveAttribute('required');
    
    // 2. 空密码提交
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', '');
    await page.click('button[type="submit"]');
    
    // HTML5 验证阻止提交，密码字段应该有错误提示
    const passwordField = page.locator('input[name="password"]');
    await expect(passwordField).toHaveAttribute('required');
  });

  test('登录错误处理', async ({ page }) => {
    // 1. 用错误的用户名登录
    await page.fill('input[name="username"]', 'nonexistentuser');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // 2. 等待错误消息显示，增加超时时间并使用更通用的选择器
    await page.waitForTimeout(2000);
    await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[class*="bg-red"]')).toContainText('Invalid username or password');
    
    // 3. 验证仍在登录页面
    await expect(page).toHaveURL('/login');
  });

  test('重复用户名注册', async ({ page }) => {
    const user = generateRandomUser();
    
    // 先注册一个用户
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // 等待注册成功后返回登录页
    await expect(page).toHaveURL('/lobby');
    await page.goto('/login');
    
    // 尝试用相同用户名再次注册
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // 验证错误消息显示
    await page.waitForTimeout(1000);
    await expect(page.locator('.bg-red-100')).toBeVisible();
    await expect(page.locator('.bg-red-100')).toContainText('Username already exists');
  });

  test('登录/注册模式切换', async ({ page }) => {
    // 1. 默认是登录模式
    await expect(page.locator('h2')).toContainText('登录');
    await expect(page.locator('button[type="submit"]')).toContainText('登录');
    await expect(page.locator('text=没有账户？立即注册')).toBeVisible();
    
    // 2. 切换到注册模式
    await page.click('text=没有账户？立即注册');
    await expect(page.locator('h2')).toContainText('注册');
    await expect(page.locator('button[type="submit"]')).toContainText('注册');
    await expect(page.locator('text=已有账户？立即登录')).toBeVisible();
    
    // 3. 验证头像字段显示
    await expect(page.locator('input[name="avatar"]')).toBeVisible();
    
    // 4. 切换回登录模式
    await page.click('text=已有账户？立即登录');
    await expect(page.locator('h2')).toContainText('登录');
    await expect(page.locator('button[type="submit"]')).toContainText('登录');
    
    // 5. 验证头像字段隐藏
    await expect(page.locator('input[name="avatar"]')).not.toBeVisible();
  });

  test('表单数据在模式切换时清空', async ({ page }) => {
    // 1. 在登录模式填写一些数据
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    
    // 2. 切换到注册模式
    await page.click('text=没有账户？立即注册');
    
    // 3. 验证表单数据被清空
    await expect(page.locator('input[name="username"]')).toHaveValue('');
    await expect(page.locator('input[name="password"]')).toHaveValue('');
    
    // 4. 在注册模式填写数据
    await page.fill('input[name="username"]', 'newuser');
    await page.fill('input[name="password"]', 'newpass');
    await page.fill('input[name="avatar"]', 'https://example.com/avatar.jpg');
    
    // 5. 切换回登录模式
    await page.click('text=已有账户？立即登录');
    
    // 6. 验证表单数据被清空
    await expect(page.locator('input[name="username"]')).toHaveValue('');
    await expect(page.locator('input[name="password"]')).toHaveValue('');
  });

  test('加载状态显示', async ({ page }) => {
    // 网络较慢时验证加载状态（可以用网络节流模拟）
    const user = generateRandomUser();
    
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    
    // 点击提交按钮
    await page.click('button[type="submit"]');
    
    // 快速检查加载状态（可能很快完成，所以这个测试可能需要调整）
    // 在实际场景中，可以通过模拟慢网络来更好地测试这个
    await expect(page.locator('button[type="submit"]')).toHaveAttribute('disabled');
  });
});