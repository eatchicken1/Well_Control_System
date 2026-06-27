console.error([
  'realtime-proxy.mjs 已停用。',
  '实时接口已经迁移到 ASP.NET Core 后端：http://127.0.0.1:5007/api/realtime',
  '请启动：dotnet run --project D:\\Study\\research\\wall_control\\V7.0\\kick_detection_system\\backend\\src\\KickDetectionSystem.Api\\KickDetectionSystem.Api.csproj --urls http://127.0.0.1:5007',
].join('\n'));
process.exitCode = 1;
