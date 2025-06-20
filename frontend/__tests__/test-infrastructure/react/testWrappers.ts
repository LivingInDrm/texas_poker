/**
 * React组件测试包装器
 * 
 * 提供统一的组件测试环境和工具
 */

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// 基础测试包装器
interface TestWrapperProps {
  children: React.ReactNode;
  initialEntries?: string[];
}

function TestWrapper({ children, initialEntries = ['/'] }: TestWrapperProps) {
  return React.createElement(
    BrowserRouter,
    {},
    children
  );
}

// 创建测试包装器工厂
export function createTestWrapper(options: {
  initialEntries?: string[];
} = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(TestWrapper, { ...options, children });
  };
}

// 增强的render函数
export interface CustomRenderOptions extends RenderOptions {
  initialEntries?: string[];
}

export function renderWithWrapper(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & {
  rerender: (ui: React.ReactElement) => void;
} {
  const {
    initialEntries,
    wrapper,
    ...renderOptions
  } = options;

  const Wrapper = wrapper || createTestWrapper({ initialEntries });

  const renderResult = render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });

  // 重写rerender以保持wrapper
  const originalRerender = renderResult.rerender;
  const rerender = (rerenderUi: React.ReactElement) => {
    originalRerender(React.createElement(Wrapper, {}, rerenderUi));
  };

  return {
    ...renderResult,
    rerender,
  };
}

// Hook测试包装器
export function createHookWrapper(options: {
  initialEntries?: string[];
} = {}) {
  const TestWrapper = createTestWrapper(options);
  
  return function HookWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(TestWrapper, {}, children);
  };
}

// 异步组件测试工具
export class AsyncComponentTester {
  private renderResult: RenderResult | null = null;
  private cleanup: (() => void) | null = null;

  constructor(
    private component: React.ReactElement,
    private options: CustomRenderOptions = {}
  ) {}

  async render(): Promise<RenderResult> {
    this.renderResult = renderWithWrapper(this.component, this.options);
    
    // 等待初始渲染完成
    await new Promise(resolve => setTimeout(resolve, 0));
    
    return this.renderResult;
  }

  async rerender(newComponent?: React.ReactElement): Promise<void> {
    if (!this.renderResult) {
      throw new Error('Component not rendered yet. Call render() first.');
    }
    
    this.renderResult.rerender(newComponent || this.component);
    
    // 等待重渲染完成
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  unmount(): void {
    if (this.renderResult) {
      this.renderResult.unmount();
      this.renderResult = null;
    }
    
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }

  onCleanup(cleanupFn: () => void): void {
    this.cleanup = cleanupFn;
  }

  get result(): RenderResult {
    if (!this.renderResult) {
      throw new Error('Component not rendered yet. Call render() first.');
    }
    return this.renderResult;
  }
}

// 测试组件工厂
export function createTestComponent(
  component: React.ReactElement,
  options: CustomRenderOptions = {}
): AsyncComponentTester {
  return new AsyncComponentTester(component, options);
}