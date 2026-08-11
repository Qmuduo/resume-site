import eslintPluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    rules: {
      // 项目既有命名习惯：Login/Register 等单文件组件
      'vue/multi-word-component-names': 'off',
      // 编辑器草稿架构：store.data 作为共享响应式对象直接传给 builder 组件并原地修改
      'vue/no-mutating-props': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' }
    }
  }
)
