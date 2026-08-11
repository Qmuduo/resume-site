<script setup lang="ts">
import { computed } from 'vue'

import RichTextEditor from './RichTextEditor.vue'
import SectionItemsEditor from './SectionItemsEditor.vue'
import type { ResumeData, ResumeSection, ResumeSectionItem } from '@/types'

const props = defineProps<{ section: string; data: ResumeData }>()
const emit = defineEmits<{ (e: 'change'): void }>()

const FIELD_MAP: Record<string, { key: string; label: string; type?: 'textarea' }[]> = {
  experience: [
    { key: 'company', label: '公司' },
    { key: 'position', label: '职位' },
    { key: 'period', label: '时间' },
    { key: 'location', label: '地点' },
    { key: 'description', label: '描述', type: 'textarea' }
  ],
  education: [
    { key: 'school', label: '学校' },
    { key: 'degree', label: '学位' },
    { key: 'major', label: '专业' },
    { key: 'period', label: '时间' },
    { key: 'description', label: '描述', type: 'textarea' }
  ],
  skills: [
    { key: 'name', label: '技能' },
    { key: 'level', label: '熟练度' }
  ],
  projects: [
    { key: 'name', label: '项目' },
    { key: 'role', label: '角色' },
    { key: 'period', label: '时间' },
    { key: 'description', label: '描述', type: 'textarea' }
  ],
  languages: [
    { key: 'name', label: '语言' },
    { key: 'level', label: '水平' }
  ],
  awards: [
    { key: 'name', label: '奖项' },
    { key: 'date', label: '时间' },
    { key: 'description', label: '说明', type: 'textarea' }
  ],
  certifications: [
    { key: 'name', label: '证书' },
    { key: 'issuer', label: '颁发机构' },
    { key: 'date', label: '时间' }
  ],
  profiles: [
    { key: 'network', label: '平台' },
    { key: 'username', label: '用户名' }
  ]
}

const currentSection = computed<ResumeSection | undefined>(() => {
  const custom = props.data.customSections.find((cs) => cs.id === props.section)
  if (custom) return custom as unknown as ResumeSection
  return props.data.sections[props.section]
})

const fields = computed(
  () => FIELD_MAP[props.section] ?? [
    { key: 'name', label: '名称' },
    { key: 'description', label: '描述', type: 'textarea' as const }
  ]
)

function setItems(list: ResumeSectionItem[]) {
  const custom = props.data.customSections.find((cs) => cs.id === props.section)
  if (custom) {
    custom.items = list
  } else if (props.data.sections[props.section]) {
    props.data.sections[props.section]!.items = list
  }
  emit('change')
}
</script>

<template>
  <div class="form-pane">
    <template v-if="section === 'basics'">
      <el-form label-width="88px">
        <el-form-item label="姓名">
          <el-input
            id="bf-name"
            :model-value="data.basics.name"
            @update:model-value="data.basics.name = $event; $emit('change')"
          />
        </el-form-item>
        <el-form-item label="头衔">
          <el-input
            id="bf-headline"
            :model-value="data.basics.headline"
            @update:model-value="data.basics.headline = $event; $emit('change')"
          />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input
            id="bf-email"
            :model-value="data.basics.email"
            @update:model-value="data.basics.email = $event; $emit('change')"
          />
        </el-form-item>
        <el-form-item label="电话">
          <el-input
            id="bf-phone"
            :model-value="data.basics.phone"
            @update:model-value="data.basics.phone = $event; $emit('change')"
          />
        </el-form-item>
        <el-form-item label="所在地">
          <el-input
            id="bf-location"
            :model-value="data.basics.location"
            @update:model-value="data.basics.location = $event; $emit('change')"
          />
        </el-form-item>
      </el-form>
    </template>
    <template v-else-if="section === 'summary'">
      <RichTextEditor
        :model-value="data.summary.content"
        @update:model-value="data.summary.content = $event; $emit('change')"
      />
    </template>
    <template v-else-if="currentSection">
      <el-input
        :model-value="currentSection.title"
        @update:model-value="currentSection.title = $event; $emit('change')"
      />
      <SectionItemsEditor
        :model-value="currentSection.items"
        :fields="fields"
        @update:model-value="setItems"
        @change="$emit('change')"
      />
    </template>
    <p
      v-else
      class="form-pane-hint"
    >
      请先在左侧添加区块
    </p>
  </div>
</template>

<style scoped>
.form-pane {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  max-height: 70vh;
  overflow: auto;
}

.form-pane-hint {
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
