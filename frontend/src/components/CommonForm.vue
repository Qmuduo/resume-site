<script setup lang="ts">
import type { ResumeCommonData } from '@/types'
import SectionListEditor, { type FieldSpec } from './SectionListEditor.vue'

const props = defineProps<{
  model: ResumeCommonData
}>()

function str(key: keyof typeof props.model.basic): string {
  const value = props.model.basic?.[key]
  return typeof value === 'string' ? value : ''
}

function setBasic(key: keyof typeof props.model.basic, value: string) {
  props.model.basic = { ...props.model.basic, [key]: value }
}

const EXPERIENCE_FIELDS: FieldSpec[] = [
  { key: 'company', label: '公司' },
  { key: 'position', label: '职位' },
  { key: 'start', label: '开始' },
  { key: 'end', label: '结束' },
  { key: 'description', label: '描述', type: 'textarea' }
]

const EDUCATION_FIELDS: FieldSpec[] = [
  { key: 'school', label: '学校' },
  { key: 'degree', label: '学位' },
  { key: 'major', label: '专业' },
  { key: 'start', label: '开始' },
  { key: 'end', label: '结束' }
]

const SKILL_FIELDS: FieldSpec[] = [
  { key: 'name', label: '技能' },
  { key: 'level', label: '熟练程度' }
]

const SOCIAL_FIELDS: FieldSpec[] = [
  { key: 'platform', label: '平台' },
  { key: 'url', label: '链接' }
]

const PROJECT_FIELDS: FieldSpec[] = [
  { key: 'name', label: '项目' },
  { key: 'role', label: '角色' },
  { key: 'start', label: '开始' },
  { key: 'end', label: '结束' },
  { key: 'description', label: '描述', type: 'textarea' },
  { key: 'link', label: '链接' }
]

const CERT_FIELDS: FieldSpec[] = [
  { key: 'name', label: '证书' },
  { key: 'issuer', label: '颁发机构' },
  { key: 'date', label: '时间' }
]

const LANGUAGE_FIELDS: FieldSpec[] = [
  { key: 'name', label: '语言' },
  { key: 'level', label: '水平' }
]

const AWARD_FIELDS: FieldSpec[] = [
  { key: 'name', label: '奖项' },
  { key: 'date', label: '时间' },
  { key: 'description', label: '说明', type: 'textarea' }
]

function setInterest(index: number, value: string) {
  props.model.interests[index] = value
}

function addInterest() {
  props.model.interests = [...props.model.interests, '']
}

function removeInterest(index: number) {
  props.model.interests = props.model.interests.filter((_, i) => i !== index)
}
</script>

<template>
  <el-form label-width="84px" class="common-form">
    <el-divider content-position="left">基本信息</el-divider>
    <el-form-item label="姓名">
      <el-input :model-value="str('name')" @update:model-value="setBasic('name', $event)" />
    </el-form-item>
    <el-form-item label="求职意向">
      <el-input :model-value="str('title')" @update:model-value="setBasic('title', $event)" />
    </el-form-item>
    <el-form-item label="手机">
      <el-input :model-value="str('phone')" @update:model-value="setBasic('phone', $event)" />
    </el-form-item>
    <el-form-item label="邮箱">
      <el-input :model-value="str('email')" @update:model-value="setBasic('email', $event)" />
    </el-form-item>
    <el-form-item label="地址">
      <el-input :model-value="str('address')" @update:model-value="setBasic('address', $event)" />
    </el-form-item>
    <el-form-item label="城市">
      <el-input :model-value="str('location')" @update:model-value="setBasic('location', $event)" />
    </el-form-item>
    <el-form-item label="头像">
      <el-input :model-value="str('avatar')" @update:model-value="setBasic('avatar', $event)" placeholder="图片 URL" />
    </el-form-item>

    <el-divider content-position="left">个人简介</el-divider>
    <el-input
      type="textarea"
      :rows="3"
      :model-value="typeof model.summary === 'string' ? model.summary : ''"
      placeholder="一句话摘要或个人描述"
      @update:model-value="model.summary = $event"
    />

    <el-divider content-position="left">工作经历</el-divider>
    <SectionListEditor
      v-model="model.experiences"
      :fields="EXPERIENCE_FIELDS"
      title-key="company"
      add-label="添加工作经历"
    />

    <el-divider content-position="left">教育背景</el-divider>
    <SectionListEditor
      v-model="model.education"
      :fields="EDUCATION_FIELDS"
      title-key="school"
      add-label="添加教育经历"
    />

    <el-divider content-position="left">技能清单</el-divider>
    <SectionListEditor
      v-model="model.skills"
      :fields="SKILL_FIELDS"
      title-key="name"
      add-label="添加技能"
    />

    <el-divider content-position="left">社交链接</el-divider>
    <SectionListEditor
      v-model="model.socials"
      :fields="SOCIAL_FIELDS"
      title-key="platform"
      add-label="添加链接"
    />

    <el-divider content-position="left">项目经验</el-divider>
    <SectionListEditor
      v-model="model.projects"
      :fields="PROJECT_FIELDS"
      title-key="name"
      add-label="添加项目"
    />

    <el-divider content-position="left">证书</el-divider>
    <SectionListEditor
      v-model="model.certifications"
      :fields="CERT_FIELDS"
      title-key="name"
      add-label="添加证书"
    />

    <el-divider content-position="left">语言能力</el-divider>
    <SectionListEditor
      v-model="model.languages"
      :fields="LANGUAGE_FIELDS"
      title-key="name"
      add-label="添加语言"
    />

    <el-divider content-position="left">荣誉奖项</el-divider>
    <SectionListEditor
      v-model="model.awards"
      :fields="AWARD_FIELDS"
      title-key="name"
      add-label="添加奖项"
    />

    <el-divider content-position="left">兴趣爱好</el-divider>
    <div v-for="(item, index) in model.interests" :key="index" class="interest-row">
      <el-input
        :model-value="typeof item === 'string' ? item : ''"
        @update:model-value="setInterest(index, $event)"
      />
      <el-button size="small" @click="removeInterest(index)">删除</el-button>
    </div>
    <el-button size="small" type="primary" plain @click="addInterest">添加兴趣</el-button>
  </el-form>
</template>

<style scoped>
.common-form {
  width: 100%;
}

.interest-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
