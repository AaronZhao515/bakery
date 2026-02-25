/**
 * 全局状态管理模块
 * @module utils/store
 * @description 轻量级全局状态管理，支持响应式更新
 */

/**
 * 创建响应式存储
 * @param {Object} initialState - 初始状态
 * @returns {Object} 响应式存储对象
 */
function createReactiveStore(initialState = {}) {
  const state = deepClone(initialState);
  const listeners = new Map();
  const computedCache = new Map();

  /**
   * 深克隆对象
   * @param {*} obj - 要克隆的对象
   * @returns {*} 克隆后的对象
   */
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
      const cloned = {};
      Object.keys(obj).forEach(key => {
        cloned[key] = deepClone(obj[key]);
      });
      return cloned;
    }
    return obj;
  }

  /**
   * 通知监听器
   * @param {string} path - 状态路径
   * @param {*} newValue - 新值
   * @param {*} oldValue - 旧值
   */
  function notify(path, newValue, oldValue) {
    // 通知特定路径的监听器
    if (listeners.has(path)) {
      listeners.get(path).forEach(callback => {
        try {
          callback(newValue, oldValue, path);
        } catch (error) {
          console.error(`[Store] 监听器执行失败: ${path}`, error);
        }
      });
    }

    // 通知通配符监听器
    const parentPaths = path.split('.');
    for (let i = parentPaths.length - 1; i > 0; i--) {
      const parentPath = parentPaths.slice(0, i).join('.');
      const wildcardPath = `${parentPath}.*`;
      if (listeners.has(wildcardPath)) {
        listeners.get(wildcardPath).forEach(callback => {
          try {
            callback(newValue, oldValue, path);
          } catch (error) {
            console.error(`[Store] 通配符监听器执行失败: ${wildcardPath}`, error);
          }
        });
      }
    }

    // 通知全局监听器
    if (listeners.has('*')) {
      listeners.get('*').forEach(callback => {
        try {
          callback(newValue, oldValue, path);
        } catch (error) {
          console.error('[Store] 全局监听器执行失败', error);
        }
      });
    }

    // 清除相关计算缓存
    computedCache.forEach((_, key) => {
      if (key.startsWith(path) || path.startsWith(key)) {
        computedCache.delete(key);
      }
    });
  }

  /**
   * 根据路径获取状态值
   * @param {string} path - 状态路径
   * @returns {*} 状态值
   */
  function getValueByPath(path) {
    const keys = path.split('.');
    let value = state;
    for (const key of keys) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }
    return value;
  }

  /**
   * 根据路径设置状态值
   * @param {string} path - 状态路径
   * @param {*} value - 新值
   */
  function setValueByPath(path, value) {
    const keys = path.split('.');
    let current = state;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    const lastKey = keys[keys.length - 1];
    const oldValue = current[lastKey];
    current[lastKey] = deepClone(value);
    notify(path, value, oldValue);
  }

  /**
   * 创建嵌套存储对象
   * @param {string} basePath - 基础路径
   * @returns {Object} 嵌套存储对象
   */
  function createNestedStore(basePath) {
    return {
      /**
       * 获取状态值
       * @param {string} path - 子路径（可选）
       * @returns {*} 状态值
       */
      get(path = '') {
        const fullPath = path ? `${basePath}.${path}` : basePath;
        return getValueByPath(fullPath);
      },

      /**
       * 设置状态值
       * @param {string|Object} path - 子路径或更新对象
       * @param {*} value - 新值
       */
      set(path, value) {
        if (typeof path === 'object') {
          // 批量更新
          Object.keys(path).forEach(key => {
            const fullPath = `${basePath}.${key}`;
            const oldValue = getValueByPath(fullPath);
            setValueByPath(fullPath, path[key]);
            notify(fullPath, path[key], oldValue);
          });
        } else {
          const fullPath = `${basePath}.${path}`;
          const oldValue = getValueByPath(fullPath);
          setValueByPath(fullPath, value);
          notify(fullPath, value, oldValue);
        }
      },

      /**
       * 更新状态（合并对象）
       * @param {Object} updates - 更新对象
       */
      update(updates) {
        const current = this.get();
        const merged = { ...current, ...updates };
        setValueByPath(basePath, merged);
        notify(basePath, merged, current);
      },

      /**
       * 重置状态
       * @param {*} defaultValue - 默认值
       */
      reset(defaultValue = undefined) {
        const oldValue = getValueByPath(basePath);
        const initialValue = defaultValue !== undefined 
          ? defaultValue 
          : getValueByPath(`_initial.${basePath}`);
        setValueByPath(basePath, initialValue);
        notify(basePath, initialValue, oldValue);
      },

      /**
       * 订阅状态变化
       * @param {string} path - 子路径
       * @param {Function} callback - 回调函数
       * @returns {Function} 取消订阅函数
       */
      subscribe(path, callback) {
        const fullPath = `${basePath}.${path}`;
        return store.subscribe(fullPath, callback);
      },

      /**
       * 监听状态变化（一次性）
       * @param {string} path - 子路径
       * @param {Function} callback - 回调函数
       * @returns {Function} 取消监听函数
       */
      watch(path, callback) {
        const fullPath = `${basePath}.${path}`;
        return store.watch(fullPath, callback);
      }
    };
  }

  // 保存初始状态用于重置
  state._initial = deepClone(initialState);

  // 创建主存储对象
  const store = {
    /**
     * 获取完整状态或指定路径的值
     * @param {string} path - 状态路径（可选）
     * @returns {*} 状态值
     */
    getState(path = '') {
      if (!path) return deepClone(state);
      return getValueByPath(path);
    },

    /**
     * 设置状态值
     * @param {string|Object} path - 状态路径或更新对象
     * @param {*} value - 新值
     */
    setState(path, value) {
      if (typeof path === 'object') {
        // 批量更新
        Object.keys(path).forEach(key => {
          const oldValue = getValueByPath(key);
          setValueByPath(key, path[key]);
          notify(key, path[key], oldValue);
        });
      } else {
        const oldValue = getValueByPath(path);
        setValueByPath(path, value);
        notify(path, value, oldValue);
      }
    },

    /**
     * 订阅状态变化
     * @param {string} path - 状态路径
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(path, callback) {
      if (!listeners.has(path)) {
        listeners.set(path, new Set());
      }
      listeners.get(path).add(callback);

      // 返回取消订阅函数
      return () => {
        const pathListeners = listeners.get(path);
        if (pathListeners) {
          pathListeners.delete(callback);
          if (pathListeners.size === 0) {
            listeners.delete(path);
          }
        }
      };
    },

    /**
     * 监听状态变化（一次性，值变化时触发）
     * @param {string} path - 状态路径
     * @param {Function} callback - 回调函数
     * @param {Object} options - 配置项
     * @returns {Function} 取消监听函数
     */
    watch(path, callback, options = {}) {
      const { immediate = false, deep = false } = options;
      let lastValue = getValueByPath(path);

      if (immediate) {
        callback(lastValue, undefined, path);
      }

      const unsubscribe = this.subscribe(path, (newValue, oldValue, changedPath) => {
        const shouldTrigger = deep 
          ? changedPath.startsWith(path) 
          : changedPath === path;

        if (shouldTrigger && JSON.stringify(newValue) !== JSON.stringify(lastValue)) {
          lastValue = deepClone(newValue);
          callback(newValue, oldValue, changedPath);
        }
      });

      return unsubscribe;
    },

    /**
     * 计算属性
     * @param {string} name - 计算属性名称
     * @param {Function} getter - 计算函数
     * @returns {*} 计算结果
     */
    computed(name, getter) {
      if (computedCache.has(name)) {
        return computedCache.get(name);
      }

      const result = getter(this.getState());
      computedCache.set(name, result);
      return result;
    },

    /**
     * 重置所有状态
     */
    reset() {
      const oldState = deepClone(state);
      Object.keys(initialState).forEach(key => {
        state[key] = deepClone(initialState[key]);
      });
      notify('*', state, oldState);
    },

    /**
     * 创建子存储
     * @param {string} namespace - 命名空间
     * @returns {Object} 子存储对象
     */
    namespace(namespace) {
      return createNestedStore(namespace);
    }
  };

  // 为每个顶层属性创建命名空间访问器
  Object.keys(initialState).forEach(key => {
    Object.defineProperty(store, key, {
      get() {
        return createNestedStore(key);
      },
      enumerable: true
    });
  });

  return store;
}

/**
 * 创建页面状态绑定
 * @param {Object} page - 页面对象
 * @param {Object} store - 存储对象
 * @param {Object} mapState - 状态映射
 * @returns {Object} 绑定对象
 */
function createPageBindings(page, store, mapState = {}) {
  const bindings = {};
  const unsubscribes = [];

  Object.keys(mapState).forEach(key => {
    const path = mapState[key];
    
    // 初始化数据
    if (page.data) {
      page.setData({
        [key]: store.getState(path)
      });
    }

    // 订阅状态变化
    const unsubscribe = store.subscribe(path, (newValue) => {
      if (page.setData) {
        page.setData({ [key]: newValue });
      }
    });

    unsubscribes.push(unsubscribe);
  });

  // 保存取消绑定函数
  bindings.unbind = () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };

  return bindings;
}

/**
 * 创建组件状态绑定
 * @param {Object} component - 组件对象
 * @param {Object} store - 存储对象
 * @param {Object} mapState - 状态映射
 * @returns {Object} 绑定对象
 */
function createComponentBindings(component, store, mapState = {}) {
  const bindings = {};
  const unsubscribes = [];

  // 在组件attached时绑定
  const originalAttached = (component.lifetimes && component.lifetimes.attached) || component.attached;
  
  const newAttached = function() {
    Object.keys(mapState).forEach(key => {
      const path = mapState[key];
      
      // 初始化数据
      this.setData({
        [key]: store.getState(path)
      });

      // 订阅状态变化
      const unsubscribe = store.subscribe(path, (newValue) => {
        this.setData({ [key]: newValue });
      });

      unsubscribes.push(unsubscribe);
    });

    // 调用原attached
    if (originalAttached) {
      originalAttached.call(this);
    }
  };

  // 在组件detached时解绑
  const originalDetached = (component.lifetimes && component.lifetimes.detached) || component.detached;
  
  const newDetached = function() {
    // 取消所有订阅
    unsubscribes.forEach(unsubscribe => unsubscribe());
    unsubscribes.length = 0;

    // 调用原detached
    if (originalDetached) {
      originalDetached.call(this);
    }
  };

  // 更新组件生命周期
  if (component.lifetimes) {
    component.lifetimes.attached = newAttached;
    component.lifetimes.detached = newDetached;
  } else {
    component.attached = newAttached;
    component.detached = newDetached;
  }

  bindings.unbind = () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
    unsubscribes.length = 0;
  };

  return bindings;
}

/**
 * 创建全局状态绑定
 * @param {Object} initialState - 初始状态
 * @returns {Object} 全局状态存储
 */
function createStoreBindings(initialState) {
  const store = createReactiveStore(initialState);

  // 提供页面和组件绑定的便捷方法
  store.bindToPage = function(page, mapState) {
    return createPageBindings(page, this, mapState);
  };

  store.bindToComponent = function(component, mapState) {
    return createComponentBindings(component, this, mapState);
  };

  return store;
}

// 导出模块
module.exports = {
  createReactiveStore,
  createStoreBindings,
  createPageBindings,
  createComponentBindings
};
