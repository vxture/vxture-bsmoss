// Versioned built-in reference policies. No workspace override or production approval.
export const TOPIC_POLICY='bsmoss-demo-topics-v1';
export const TOPIC_THRESHOLDS=Object.freeze({loadWarningPct:85,loadCriticalPct:95,connectionWarningPct:98,connectionCriticalPct:95,temperatureWarningC:35,temperatureCriticalC:40,intensityWarning:.15,intensityCritical:.30});
export const WAVE_POLICY=Object.freeze({relativeBps:1500,minimum:Object.freeze({bytes:'1073741824',voiceSeconds:'300',sms:'20'}),baselineWeeks:Object.freeze([1,2,3,4])});
export const VERIFICATION_POLICY_VERSION='bsmoss-demo-verification-policy-v1';
export const ZERO_RUN_MIN_HOURS=3;
export const COHORT_CHANGE_PERCENT=10;
