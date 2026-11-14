import type {MonitoringParameters} from "../domains/monitoring/parameters";
export function runtimePolicyLabels(p:Readonly<MonitoringParameters>){
 const rules={battery:{warning:p.batteryAttention?"\u84c4\u7535\u6c60\u4f9b\u7535":"\u672a\u542f\u7528",critical:null},temperature:{warning:"\u2265"+p.temperatureWarningC+"\u00b0C",critical:"\u2265"+p.temperatureCriticalC+"\u00b0C"},intensity:{warning:"\u2265"+p.intensityWarning,critical:"\u2265"+p.intensityCritical}};
 const tips={battery:p.batteryAttention?"\u84c4\u7535\u6c60\u4f9b\u7535\u4ec5\u8bbe\u5173\u6ce8\u7ea7\u522b\u3002":"\u84c4\u7535\u6c60\u4f9b\u7535\u5173\u6ce8\u5df2\u5173\u95ed\u3002",temperature:"\u5173\u6ce8 "+p.temperatureWarningC+"\u2264\u6e29\u5ea6<"+p.temperatureCriticalC+"\u00b0C\uff1b\u4e25\u91cd \u2265"+p.temperatureCriticalC+"\u00b0C\u3002",intensity:"\u5355\u4f4d kWh/GiB\uff1b\u5173\u6ce8 "+p.intensityWarning+"\u2264\u5f3a\u5ea6<"+p.intensityCritical+"\uff1b\u4e25\u91cd \u2265"+p.intensityCritical+"\u3002"};
 return {rules,tips,summary:tips.temperature+tips.intensity+tips.battery};
}
