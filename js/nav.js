/**
 * 导航页面交互脚本
 * 实现搜索、筛选、收藏、分区切换等功能
 */

class NavPage {
  constructor(options = {}) {
    // 防重复初始化保护
    if (NavPage.instance) {
      return NavPage.instance;
    }
    NavPage.instance = this;
    
    // 配置选项
    this.config = {
      categoryClickBehavior: 'filter'
    };
    
    this.state = {
      currentSection: 'all',
      currentTab: 'all',
      searchQuery: '',
      itemsPerPage: 12,
      currentPage: 1,
      maxVisibleItems: 12
    };
    this.allItems = [];
    this.filteredItems = [];
    
    // 初始化标记
    this.initialized = false;
    this.userInteracted = false;
    
    // 标记这是首次实例化，用于检测直接访问
    this.isFirstInstance = !window.navPageEverInitialized;
    window.navPageEverInitialized = true;
    
    this.init();
  }

  init() {
    // 防重复初始化
    if (this.initialized) {
      console.warn('NavPage already initialized');
      return;
    }
    
    // 确保DOM元素存在后再初始化
    this.waitForElements().then(() => {
      this.bindEvents();
      this.bindCardClickEvents();
      this.initSections();
      this.initItems();
      
      // 强制刷新显示状态，确保首次加载正确
      this.forceRefreshDisplay();
      
      this.updateStats();
      this.handleUrlParams();
      
      this.initialized = true;
      
      // 触发自定义事件，通知页面初始化完成
      document.dispatchEvent(new CustomEvent('navPageInitialized', {
        detail: { instance: this }
      }));
    });
  }

  bindEvents() {
    // 搜索功能 - 添加防抖优化
    const searchInput = document.getElementById('nav-search');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.userInteracted = true;
          this.state.searchQuery = e.target.value.toLowerCase();
          this.resetPagination();
          this.filterItems();
          // 添加标签状态同步
          this.updateTagStates();
        }, 300); // 300ms防抖
      });
    }

    // 侧边栏分类链接处理 - 处理二级分类跳转
    document.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.menus_item_child');
      if (menuItem && window.location.pathname.includes('/nav/')) {
        const linkElement = e.target.closest('a.site-page.child');
        if (linkElement) {
          const linkText = linkElement.textContent.trim();
          console.log('侧边栏分类链接点击:', linkText);
          
          const categoryMapping = this.getCategoryMapping();
          console.log('分类映射表:', categoryMapping);
          
          if (categoryMapping[linkText]) {
            e.preventDefault();
            this.userInteracted = true;
            const { section, tab } = categoryMapping[linkText];
            console.log('映射到:', section, tab);
            this.switchTab(section, tab);
          } else {
            console.warn('未找到分类映射:', linkText);
          }
        }
      }
    });

    // 绑定标签点击事件 - 支持div容器点击
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.nav-tab');
      if (tab) {
        e.preventDefault();
        this.userInteracted = true;
        const section = tab.dataset.section;
        const tabName = tab.dataset.tab;
        if (section && tabName) {
          // 检查是否点击了已激活的标签
          const isCurrentlyActive = tab.classList.contains('active');
          
          if (isCurrentlyActive) {
            // 如果点击的是已激活的标签，取消选中，返回显示所有内容
            this.switchTab('all', 'all');
          } else {
            // 正常切换到该标签（内容过滤）
            this.switchTab(section, tabName);
          }
        }
      }
    });
    

    
    // 查看更多按钮点击事件
    document.addEventListener('click', (e) => {
      if (e.target.closest('.nav-more-link')) {
        e.preventDefault();
        this.showMore();
      }
    });



    // URL参数监听
    window.addEventListener('popstate', () => {
      this.handleUrlParams();
    });
  }

  bindCardClickEvents() {
    // 卡片点击事件
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (navItem && !e.target.closest('.nav-item-favorite') && !e.target.closest('.nav-item-tag')) {
        // 从内部的a标签获取URL，而不是从dataset
        const linkElement = navItem.querySelector('.nav-item-clickable');
        const url = linkElement ? linkElement.href : navItem.dataset.url;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    });
    
    // 标签点击事件 - 添加到搜索栏或取消选中
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('nav-item-tag')) {
        // 更强力地阻止事件冒泡和默认行为
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const tagText = e.target.textContent.trim();
        const searchInput = document.getElementById('nav-search');
        
        if (tagText && searchInput) {
          const currentValue = searchInput.value.trim();
          const keywords = currentValue ? currentValue.split(' ').filter(k => k.length > 0) : [];
          
          // 检查标签是否已选中
          const isSelected = keywords.includes(tagText);
          
          if (isSelected) {
            // 取消选中：从搜索栏中移除该标签
            const updatedKeywords = keywords.filter(k => k !== tagText);
            searchInput.value = updatedKeywords.join(' ');
            
            // 移除选中状态样式
            e.target.classList.remove('selected');
          } else {
            // 添加标签到搜索栏
            keywords.push(tagText);
            searchInput.value = keywords.join(' ');
            
            // 添加选中状态样式
            e.target.classList.add('selected');
          }
          
          // 触发搜索
          this.state.searchQuery = searchInput.value;
          this.filterItems();
          
          // 更新所有标签的选中状态
          this.updateTagStates();
        }
        
        // 立即返回false以进一步阻止事件传播
        return false;
      }
    }, true);
    
    // 键盘支持
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const navItem = e.target.closest('.nav-item');
        
        if (navItem) {
          e.preventDefault();
          // 从内部的a标签获取URL，与鼠标点击事件保持一致
          const linkElement = navItem.querySelector('.nav-item-clickable');
          const url = linkElement ? linkElement.href : navItem.dataset.url;
          if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        }
      }
    });
  }

  initSections() {
    const sections = document.querySelectorAll('.nav-section');
    if (sections.length > 0) {
      // 只在没有设置状态时才使用默认值
      if (!this.state.currentSection) {
        const firstSection = sections[0];
        this.state.currentSection = firstSection.dataset.section;
        
        // 激活第一个标签
        const firstTab = firstSection.querySelector('.nav-tab');
        if (firstTab && !this.state.currentTab) {
          this.state.currentTab = firstTab.dataset.tab;
        }
      }
      
      // 更新UI状态
      this.updateTabUI();
      this.showSection(this.state.currentSection);
    }
  }

  initItems() {
    // 获取所有导航项目
    const items = document.querySelectorAll('.nav-item');
    this.allItems = Array.from(items);
    
    // 确保有项目才进行后续操作
    if (this.allItems.length > 0) {
      this.filteredItems = [...this.allItems];
      
      // 初始化每个项目的显示状态
      this.allItems.forEach(item => {
        if (!item.style.display) {
          item.style.display = 'block';
        }
      });
      
      this.filterItems();
    } else {
      console.warn('NavPage: 未找到导航项目元素');
      this.filteredItems = [];
    }
  }



  switchTab(section, tab) {
    console.log('🔄 switchTab called with:', { section, tab });
    
    try {
      // 标记用户已交互
      this.userInteracted = true;
      
      // 更新当前状态
      this.state.currentSection = section;
      this.state.currentTab = tab;
      console.log('📊 State updated:', this.state);
      
      // 重置分页状态
      this.resetPagination();
      
      // 显示对应分区
      this.showSection(section);
      
      // 更新标签UI状态
      this.updateTabUI();
      
      // 过滤显示
      this.filterItems();
      
      // 更新URL
      this.updateUrl();
      
      console.log('✅ switchTab completed');
      
    } catch (error) {
      console.error('❌ Error in switchTab:', error);
      // 即使出错也要移除切换状态
      this.removeSwitchingFeedback();
    }
  }

  showSection(section) {
    document.querySelectorAll('.nav-section').forEach(s => {
      // 如果section是'all'或为空，显示所有分区
      if (section === 'all' || !section) {
        s.style.display = 'block';
      } else {
        s.style.display = s.dataset.section === section ? 'block' : 'none';
      }
    });
  }

  updateTabUI() {
    // 清除所有标签的激活状态
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    
    // 激活当前标签
    if (this.state.currentSection && this.state.currentTab) {
      // 如果是'all'状态，不激活任何特定标签
      if (this.state.currentSection === 'all' && this.state.currentTab === 'all') {
        // 显示所有内容，不激活特定标签
        return;
      }
      
      // 修复选择器：确保正确匹配.nav-tab元素
      const currentTab = document.querySelector(`.nav-tab[data-section="${this.state.currentSection}"][data-tab="${this.state.currentTab}"]`);
      console.log('Looking for tab:', this.state.currentSection, this.state.currentTab);
      console.log('Found tab element:', currentTab);
      
      if (currentTab) {
        currentTab.classList.add('active');
        console.log('Added active class to tab:', currentTab);
      } else {
        console.warn('Tab element not found for:', this.state.currentSection, this.state.currentTab);
        // 备用方案：尝试只通过data-tab查找
        const fallbackTab = document.querySelector(`.nav-tab[data-tab="${this.state.currentTab}"]`);
        if (fallbackTab) {
          fallbackTab.classList.add('active');
          console.log('Used fallback selector, activated tab:', fallbackTab);
        }
      }
    }
  }

  filterItems() {
    console.log('🔍 filterItems called with state:', {
      section: this.state.currentSection,
      tab: this.state.currentTab,
      search: this.state.searchQuery,
      totalItems: this.allItems?.length || 0
    });
    
    this.filteredItems = this.allItems.filter(item => {
      // 分区过滤 - 'all'表示显示所有分区
      if (this.state.currentSection && this.state.currentSection !== 'all' && item.dataset.section !== this.state.currentSection) {
        console.log('❌ Item filtered by section:', item.dataset.section, 'vs', this.state.currentSection);
        return false;
      }
      
      // 标签过滤 - 'all'表示显示所有标签
      if (this.state.currentTab && this.state.currentTab !== 'all' && item.dataset.tab !== this.state.currentTab) {
        console.log('❌ Item filtered by tab:', item.dataset.tab, 'vs', this.state.currentTab);
        return false;
      }
      
      // 搜索过滤 - 支持多关键词(空格分隔)
      if (this.state.searchQuery) {
        const keywords = this.state.searchQuery.toLowerCase().split(' ').filter(k => k.trim().length > 0);
        const name = (item.querySelector('.nav-item-title')?.textContent || '').toLowerCase();
        const desc = (item.querySelector('.nav-item-desc')?.textContent || '').toLowerCase();
        const tags = (item.dataset.tags || '').toLowerCase();
        const searchText = `${name} ${desc} ${tags}`;
        
        // 所有关键词都必须匹配(AND逻辑)
        const allKeywordsMatch = keywords.every(keyword => 
          searchText.includes(keyword)
        );
        
        if (!allKeywordsMatch) {
          return false;
        }
      }
      

      
      // 状态过滤
      if (item.dataset.status === 'inactive') {
        return false;
      }
      
      return true;
    });
    
    console.log('✅ filterItems completed:', {
      filteredCount: this.filteredItems.length,
      totalCount: this.allItems.length,
      filteredItems: this.filteredItems.slice(0, 3).map(item => ({
        section: item.dataset.section,
        tab: item.dataset.tab,
        title: item.querySelector('.nav-item-title')?.textContent
      }))
    });
    
    this.updateDisplay();
    this.updateStats();
  }

  updateDisplay() {
    console.log('🎨 updateDisplay called');
    let visibleCount = 0;
    let displayedCount = 0;
    const maxVisible = this.state.maxVisibleItems || this.state.itemsPerPage;
    
    // 确保allItems和filteredItems已初始化
    if (!this.allItems || !this.filteredItems) {
      console.warn('⚠️ updateDisplay: allItems or filteredItems not initialized');
      return;
    }
    
    console.log('📊 Display parameters:', {
      maxVisible,
      filteredItemsCount: this.filteredItems.length,
      allItemsCount: this.allItems.length
    });
    
    this.allItems.forEach(item => {
      if (this.filteredItems.includes(item)) {
        visibleCount++;
        // 应用分页限制
        if (displayedCount < maxVisible) {
          item.style.display = 'block';
          displayedCount++;
        } else {
          item.style.display = 'none';
        }
      } else {
        item.style.display = 'none';
      }
    });
    
    // 显示空状态
    const isEmpty = visibleCount === 0;
    const emptyState = document.querySelector('.nav-empty');
    if (emptyState) {
      emptyState.style.display = isEmpty ? 'block' : 'none';
    }
    
    console.log('✅ updateDisplay completed:', {
      visibleCount,
      displayedCount,
      isEmpty,
      maxVisible
    });
    
    // 更新查看更多按钮
    this.updateShowMoreButton();
  }





  updateStats() {
    const totalCount = document.getElementById('nav-total-count');
    if (totalCount) {
      const count = this.filteredItems.length;
      const total = this.allItems.length;
      totalCount.textContent = this.state.searchQuery ? 
        `显示 ${count} / ${total} 个网站` : 
        `共 ${total} 个网站`;
    }
  }
  
  updateTagStates() {
    // 更新所有标签的选中状态
    const searchInput = document.querySelector('.nav-search-input');
    if (!searchInput) return;
    
    const keywords = searchInput.value.trim().split(' ').filter(k => k.length > 0);
    const allTags = document.querySelectorAll('.nav-item-tag');
    
    allTags.forEach(tag => {
      const tagText = tag.textContent.trim();
      if (keywords.includes(tagText)) {
        tag.classList.add('selected');
      } else {
        tag.classList.remove('selected');
      }
    });
  }

  handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    const tab = params.get('tab');
    const search = params.get('search');
    
    // 改进的首次访问检测逻辑
    const isDirectNavigation = this.isDirectNavigation();
    
    // 如果用户已经交互过，不应该清除URL参数
    if (this.userInteracted) {
      // 用户已交互，正常处理URL参数
      if (section && tab) {
        this.state.currentSection = section;
        this.state.currentTab = tab;
        this.switchTab(section, tab);
      }
      
      if (search) {
        const searchInput = document.getElementById('nav-search');
        if (searchInput) {
          searchInput.value = search;
          this.state.searchQuery = search.toLowerCase();
          this.filterItems();
        }
      }
      return;
    }
    
    // 如果是直接访问导航页且URL包含参数，清除参数并显示默认页面
    if (isDirectNavigation && (section || tab)) {
      // 清除URL参数，显示默认页面
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      
      // 确保显示默认状态
      this.resetToDefault();
      return;
    }
    
    // 正常处理URL参数（用户主动导航或刷新）
    if (section && tab) {
      // 先设置状态，再调用switchTab
      this.state.currentSection = section;
      this.state.currentTab = tab;
      this.switchTab(section, tab);
    }
    
    if (search) {
      const searchInput = document.getElementById('nav-search');
      if (searchInput) {
        searchInput.value = search;
        this.state.searchQuery = search.toLowerCase();
        this.filterItems();
      }
    }
  }
  
  // 改进的直接访问检测方法
  isDirectNavigation() {
    // 如果用户已经交互过，则不是直接访问
    if (this.userInteracted) {
      return false;
    }
    
    // 检查多个条件来判断是否为直接访问
    const hasNoReferrer = !document.referrer;
    const referrerIsSamePage = document.referrer === window.location.href;
    const isPageLoad = performance.navigation && performance.navigation.type === 0;
    const isFirstInstance = this.isFirstInstance;
    
    // 如果URL中有参数但这是首次实例化且用户未交互，则认为是直接访问
    const urlHasParams = window.location.search.includes('section=') || window.location.search.includes('tab=');
    const isDirectAccessWithParams = urlHasParams && isFirstInstance;
    
    // 综合判断：没有referrer 或 referrer是同一页面 或 是直接访问带参数的情况
    return hasNoReferrer || referrerIsSamePage || isDirectAccessWithParams;
  }

  updateUrl() {
    const params = new URLSearchParams();
    
    // 只有在非默认状态时才添加URL参数
    if (this.state.currentSection && this.state.currentTab && 
        !(this.state.currentSection === 'all' && this.state.currentTab === 'all')) {
      params.set('section', this.state.currentSection);
      params.set('tab', this.state.currentTab);
    }
    
    if (this.state.searchQuery) {
      params.set('search', this.state.searchQuery);
    }
    
    const newUrl = params.toString() ? 
      `${window.location.pathname}?${params.toString()}` : 
      window.location.pathname;
    
    window.history.replaceState({}, '', newUrl);
  }

  showMore() {
    // 增加可见项目数量
    this.state.maxVisibleItems = (this.state.maxVisibleItems || this.state.itemsPerPage) + this.state.itemsPerPage;
    this.state.currentPage = (this.state.currentPage || 1) + 1;
    
    // 重新过滤和显示
    this.filterItems();
    
    // 更新查看更多按钮状态
    this.updateShowMoreButton();
  }
  
  updateShowMoreButton() {
    const showMoreLink = document.querySelector('.nav-more-link');
    const totalFilteredItems = this.filteredItems ? this.filteredItems.length : 0;
    const maxVisible = this.state.maxVisibleItems || this.state.itemsPerPage;
    
    if (showMoreLink) {
      if (maxVisible >= totalFilteredItems || totalFilteredItems === 0) {
        // 已显示所有项目或没有项目，隐藏按钮
        showMoreLink.style.display = 'none';
      } else {
        // 还有更多项目，显示按钮
        showMoreLink.style.display = 'flex';
        const remainingItems = Math.max(0, totalFilteredItems - maxVisible);
        const showMoreText = showMoreLink.querySelector('span');
        if (showMoreText) {
          showMoreText.textContent = `查看更多 (还有 ${remainingItems} 个)`;
        }
      }
    }
  }
  
  resetPagination() {
    // 重置分页状态
    this.state.currentPage = 1;
    this.state.maxVisibleItems = this.state.itemsPerPage;
  }
  
  // 强制刷新显示状态
  forceRefreshDisplay() {
    // 确保所有状态都正确初始化
    if (!this.state.maxVisibleItems) {
      this.state.maxVisibleItems = this.state.itemsPerPage;
    }
    
    if (!this.state.currentPage) {
      this.state.currentPage = 1;
    }
    
    // 重新过滤和显示
    this.filterItems();
    
    // 强制更新统计信息
    setTimeout(() => {
      this.updateStats();
      this.updateShowMoreButton();
    }, 100);
  }
  
  // 重置到默认状态
  resetToDefault() {
    // 重置状态到默认值
    this.state.currentSection = 'all';
    this.state.currentTab = 'all';
    this.state.searchQuery = '';
    
    // 清除搜索框
    const searchInput = document.getElementById('nav-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // 重新初始化分区和标签
    this.initSections();
    
    // 重置分页
    this.resetPagination();
    
    // 重新过滤和显示
    this.filterItems();
    
    // 更新显示
    this.updateStats();
    this.updateShowMoreButton();
  }
  
  // 获取分类名称映射表
  getCategoryMapping() {
    return {
      // 实用工具分类
      '开发工具': { section: 'tools', tab: 'dev' },
      '设计资源': { section: 'tools', tab: 'design' },
      '在线工具': { section: 'tools', tab: 'online' },
      '实用工具': { section: 'tools', tab: '' },
      
      // 常用网站分类
      '技术社区': { section: 'sites', tab: 'tech' },
      '学习资源': { section: 'sites', tab: 'learn' },
      '资讯媒体': { section: 'sites', tab: 'news' },
      '常用网站': { section: 'sites', tab: '' },
      
      // 资源库分类
      '图片素材': { section: 'resources', tab: 'images' },
      '字体资源': { section: 'resources', tab: 'fonts' },
      '图标库': { section: 'resources', tab: 'icons' },
      '资源库': { section: 'resources', tab: '' },
      
      // 特殊映射
      '导航': { section: '', tab: '' }, // 显示所有内容
      'all': { section: '', tab: '' },
      '全部': { section: '', tab: '' }
    };
  }

  // 等待DOM元素加载完成
  waitForElements() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 最多等待5秒
      
      const checkElements = () => {
        const navItems = document.querySelectorAll('.nav-item');
        const navSections = document.querySelectorAll('.nav-section');
        const navContainer = document.querySelector('.nav-container, .nav-content, #nav-content');
        
        attempts++;
        
        if (navItems.length > 0 && navSections.length > 0) {
          // 额外等待一小段时间确保所有样式都已应用
          setTimeout(() => resolve(), 50);
        } else if (attempts >= maxAttempts) {
          // 超时后强制初始化，避免无限等待
          console.warn('NavPage: 等待元素超时，强制初始化');
          resolve();
        } else {
          // 如果元素还没加载完成，等待一段时间后重试
          setTimeout(checkElements, 100);
        }
      };
      
      checkElements();
    });
  }



}

// 全局实例
let navPage;

// DOM加载完成后初始化
function initNavPage() {
  // 防止重复初始化
  if (window.navPage && window.navPage.initialized) {
    return;
  }
  
  navPage = new NavPage();
  window.navPage = navPage;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavPage);
} else {
  // 如果DOM已经加载完成，延迟一点时间确保所有元素都渲染完毕
  setTimeout(initNavPage, 50);
}

// 导出供模板使用
if (!window.navPage) {
  window.navPage = navPage;
}

// 添加全局方法供外部调用
window.refreshNavPage = function() {
  if (window.navPage && window.navPage.forceRefreshDisplay) {
    window.navPage.forceRefreshDisplay();
  }
};