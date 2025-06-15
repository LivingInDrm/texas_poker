import { test, expect } from '@playwright/test';

// 生成随机用户名避免重复
const generateRandomUser = () => ({
  username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  password: 'testpassword123'
});

test.describe('用户认证流程 - 简化版', () => {
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

  test('登录/注册模式切换', async ({ page }) => {
    // 1. 默认是登录模式
    await expect(page.locator('h2')).toContainText('登录');
    await expect(page.locator('button[type="submit"]')).toContainText('登录');
    
    // 2. 切换到注册模式
    await page.click('text=没有账户？立即注册');
    await expect(page.locator('h2')).toContainText('注册');
    await expect(page.locator('button[type="submit"]')).toContainText('注册');
    
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

  test('注册表单验证', async ({ page }) => {
    // 切换到注册模式
    await page.click('text=没有账户？立即注册');
    
    // 1. 空用户名提交
    await page.fill('input[name="password"]', 'testpassword123');
    
    // HTML5 验证阻止提交，用户名字段应该有错误提示
    const usernameField = page.locator('input[name="username"]');
    await expect(usernameField).toHaveAttribute('required');
    
    // 2. 空密码提交
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', '');
    
    // HTML5 验证阻止提交，密码字段应该有错误提示
    const passwordField = page.locator('input[name="password"]');
    await expect(passwordField).toHaveAttribute('required');
  });

  test('大厅页面基本功能', async ({ page }) => {
    const user = generateRandomUser();
    
    // 注册并登录
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // 验证在大厅页面
    await expect(page).toHaveURL('/lobby');
    
    // 验证大厅页面元素
    await expect(page.locator('h2')).toContainText('游戏大厅');
    await expect(page.locator('button:has-text("创建房间")')).toBeVisible();
    await expect(page.locator('button:has-text("快速开始")')).toBeVisible();
    await expect(page.locator('h3')).toContainText('房间列表');
    
    // 验证用户信息显示
    await expect(page.locator('text=' + user.username)).toBeVisible();
    await expect(page.locator('button:has-text("退出登录")')).toBeVisible();
  });

  test('退出登录功能', async ({ page }) => {
    const user = generateRandomUser();
    
    // 注册并登录
    await page.click('text=没有账户？立即注册');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // 验证在大厅页面
    await expect(page).toHaveURL('/lobby');
    
    // 点击退出登录
    await page.click('button:has-text("退出登录")');
    
    // 验证跳转回登录页面
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h2')).toContainText('登录');
  });
});