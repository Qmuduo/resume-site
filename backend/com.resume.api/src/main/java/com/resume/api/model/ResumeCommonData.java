package com.resume.api.model;

import java.util.ArrayList;
import java.util.List;

/**
 * 简历公共数据模型，与 docs/resume-common.schema.json 保持一致。
 *
 * <p>分层约定：
 * <ul>
 *   <li>common_data：本类结构，所有模板共用，切换模板时不改变；</li>
 *   <li>extended_data：模板专属字段，key-value 形式，按模板 manifest 映射，无法映射的暂存保留。</li>
 * </ul>
 */
public class ResumeCommonData {

    /** 基本信息 */
    private BasicInfo basic;
    /** 个人简介 */
    private String summary;
    /** 工作经历 */
    private List<ExperienceItem> experiences;
    /** 教育背景 */
    private List<EducationItem> education;
    /** 技能清单 */
    private List<SkillItem> skills;
    /** 社交链接 */
    private List<SocialItem> socials;
    /** 项目经验 */
    private List<ProjectItem> projects;
    /** 证书 */
    private List<CertificationItem> certifications;
    /** 语言能力 */
    private List<LanguageItem> languages;
    /** 荣誉奖项 */
    private List<AwardItem> awards;
    /** 兴趣爱好 */
    private List<String> interests;

    public BasicInfo getBasic() {
        return basic;
    }

    public void setBasic(BasicInfo basic) {
        this.basic = basic;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public List<ExperienceItem> getExperiences() {
        return experiences;
    }

    public void setExperiences(List<ExperienceItem> experiences) {
        this.experiences = experiences;
    }

    public List<EducationItem> getEducation() {
        return education;
    }

    public void setEducation(List<EducationItem> education) {
        this.education = education;
    }

    public List<SkillItem> getSkills() {
        return skills;
    }

    public void setSkills(List<SkillItem> skills) {
        this.skills = skills;
    }

    public List<SocialItem> getSocials() {
        return socials;
    }

    public void setSocials(List<SocialItem> socials) {
        this.socials = socials;
    }

    public List<ProjectItem> getProjects() {
        return projects;
    }

    public void setProjects(List<ProjectItem> projects) {
        this.projects = projects;
    }

    public List<CertificationItem> getCertifications() {
        return certifications;
    }

    public void setCertifications(List<CertificationItem> certifications) {
        this.certifications = certifications;
    }

    public List<LanguageItem> getLanguages() {
        return languages;
    }

    public void setLanguages(List<LanguageItem> languages) {
        this.languages = languages;
    }

    public List<AwardItem> getAwards() {
        return awards;
    }

    public void setAwards(List<AwardItem> awards) {
        this.awards = awards;
    }

    public List<String> getInterests() {
        return interests;
    }

    public void setInterests(List<String> interests) {
        this.interests = interests;
    }

    /** 基本信息 */
    public static class BasicInfo {
        private String name;
        private String title;
        private String phone;
        private String email;
        private String address;
        private String location;
        private String avatar;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getPhone() {
            return phone;
        }

        public void setPhone(String phone) {
            this.phone = phone;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getAddress() {
            return address;
        }

        public void setAddress(String address) {
            this.address = address;
        }

        public String getLocation() {
            return location;
        }

        public void setLocation(String location) {
            this.location = location;
        }

        public String getAvatar() {
            return avatar;
        }

        public void setAvatar(String avatar) {
            this.avatar = avatar;
        }
    }

    /** 工作经历单条 */
    public static class ExperienceItem {
        private String company;
        private String position;
        private String start;
        private String end;
        private String description;

        public String getCompany() {
            return company;
        }

        public void setCompany(String company) {
            this.company = company;
        }

        public String getPosition() {
            return position;
        }

        public void setPosition(String position) {
            this.position = position;
        }

        public String getStart() {
            return start;
        }

        public void setStart(String start) {
            this.start = start;
        }

        public String getEnd() {
            return end;
        }

        public void setEnd(String end) {
            this.end = end;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    /** 教育背景单条 */
    public static class EducationItem {
        private String school;
        private String degree;
        private String major;
        private String start;
        private String end;
        private String description;

        public String getSchool() {
            return school;
        }

        public void setSchool(String school) {
            this.school = school;
        }

        public String getDegree() {
            return degree;
        }

        public void setDegree(String degree) {
            this.degree = degree;
        }

        public String getMajor() {
            return major;
        }

        public void setMajor(String major) {
            this.major = major;
        }

        public String getStart() {
            return start;
        }

        public void setStart(String start) {
            this.start = start;
        }

        public String getEnd() {
            return end;
        }

        public void setEnd(String end) {
            this.end = end;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    /** 技能单条 */
    public static class SkillItem {
        private String name;
        private String level;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getLevel() {
            return level;
        }

        public void setLevel(String level) {
            this.level = level;
        }
    }

    /** 社交链接单条 */
    public static class SocialItem {
        private String platform;
        private String url;

        public String getPlatform() {
            return platform;
        }

        public void setPlatform(String platform) {
            this.platform = platform;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }

    /** 项目经验单条 */
    public static class ProjectItem {
        private String name;
        private String role;
        private String start;
        private String end;
        private String description;
        private String link;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

        public String getStart() {
            return start;
        }

        public void setStart(String start) {
            this.start = start;
        }

        public String getEnd() {
            return end;
        }

        public void setEnd(String end) {
            this.end = end;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getLink() {
            return link;
        }

        public void setLink(String link) {
            this.link = link;
        }
    }

    /** 证书单条 */
    public static class CertificationItem {
        private String name;
        private String issuer;
        private String date;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getIssuer() {
            return issuer;
        }

        public void setIssuer(String issuer) {
            this.issuer = issuer;
        }

        public String getDate() {
            return date;
        }

        public void setDate(String date) {
            this.date = date;
        }
    }

    /** 语言能力单条 */
    public static class LanguageItem {
        private String name;
        private String level;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getLevel() {
            return level;
        }

        public void setLevel(String level) {
            this.level = level;
        }
    }

    /** 荣誉奖项单条 */
    public static class AwardItem {
        private String name;
        private String date;
        private String description;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDate() {
            return date;
        }

        public void setDate(String date) {
            this.date = date;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    /** 返回一个空公共数据对象，避免 NPE。 */
    public static ResumeCommonData empty() {
        ResumeCommonData data = new ResumeCommonData();
        data.setBasic(new BasicInfo());
        data.setSummary("");
        data.setExperiences(new ArrayList<>());
        data.setEducation(new ArrayList<>());
        data.setSkills(new ArrayList<>());
        data.setSocials(new ArrayList<>());
        data.setProjects(new ArrayList<>());
        data.setCertifications(new ArrayList<>());
        data.setLanguages(new ArrayList<>());
        data.setAwards(new ArrayList<>());
        data.setInterests(new ArrayList<>());
        return data;
    }
}
