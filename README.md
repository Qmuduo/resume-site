```
# 1. 设置 Java 环境
$env:JAVA_HOME='F:\Environment\java\jdk-17.0.12_windows-x64_bin\jdk-17.0.12'

$env:DB_PASSWORD='123456'

# 2. 设置 JWT Secret（注意要用引号）
$env:JWT_SECRET = "YourStrongRandomSecretKeyHere1234567890123456"

# 3. 设置管理员账号
$env:ADMIN_USERNAME='admin'
$env:ADMIN_PASSWORD='YourStrongPassword123!'

# 4. 启动项目
mvn -q spring-boot:run
```