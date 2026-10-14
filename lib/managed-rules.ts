import { normalizeFuturePlanValue, RULES, RULE_ROLES, type RuleRole, type RuleSet } from '@/content/rules';
import { appendRow, readTab, replaceTabRows, updateRow } from '@/lib/sheets';

export type ManagedRuleItem = { text: string; enabled: boolean };
export type ManagedRuleSet = Omit<RuleSet, 'items'> & { enabled: boolean; version: number; items: ManagedRuleItem[] };

function parseJson<T>(value: string | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function normalize(role: RuleRole, value: Partial<ManagedRuleSet>, current: RuleSet): ManagedRuleSet {
  const items = (value.items || current.items).map((item) => typeof item === 'string' ? { text: item, enabled: true } : { text: String(item.text || ''), enabled: item.enabled !== false });
  const futurePlanRequired = role === 'Teacher' ? false : value.futurePlanRequired ?? current.futurePlanRequired ?? false;
  const defaultPlanOptions = [
    { label: 'สนใจทำงานต่อ', value: 'สนใจทำงานต่อ' },
    { label: 'สนใจทำงานต่อและต้องการศึกษาต่อ (หากบริษัทมีโครงการเรียนต่อไปด้วยทำงานไปด้วยร่วมกับบริษัท)', value: 'สนใจทำงานต่อและต้องการศึกษาต่อ (หากบริษัทมีโครงการเรียนต่อไปด้วยทำงานไปด้วยร่วมกับบริษัท)' },
    { label: 'ไม่สนใจทำงานต่อ', value: 'ไม่สนใจทำงานต่อ' },
  ];
  const sourceOptions = value.futurePlanOptions?.length ? value.futurePlanOptions : current.futurePlanOptions?.length ? current.futurePlanOptions : futurePlanRequired ? defaultPlanOptions : [];
  const options = sourceOptions.map((option) => {
    const label = normalizeFuturePlanValue(String(option.label || ''));
    return { label, value: label };
  });
  return {
    ...current,
    ...value,
    enabled: value.enabled !== false,
    title: String(value.title ?? current.title).trim().slice(0, 160),
    roleLabel: String(value.roleLabel ?? current.roleLabel).trim().slice(0, 120),
    intro: String(value.intro ?? current.intro ?? '').slice(0, 2000),
    items: items.filter((item) => item.text.trim()).slice(0, 100),
    futurePlanRequired,
    futurePlanOptions: options.map((option) => ({ label: String(option.label).slice(0, 180), value: String(option.value).slice(0, 180) })).filter((option) => option.label && option.value),
    updatedAt: String(value.updatedAt ?? current.updatedAt ?? new Date().toISOString().slice(0, 10)),
    version: Math.max(1, Number(value.version) || 1),
  };
}

export async function getManagedRules(): Promise<Record<RuleRole, ManagedRuleSet>> {
  const rows = await readTab('Rules');
  const result = {} as Record<RuleRole, ManagedRuleSet>;
  for (const role of RULE_ROLES) {
    const row = rows.find((entry) => entry.role === role);
    const base = RULES[role];
    if (!row) {
      result[role] = normalize(role, { ...base, items: base.items.map((text) => ({ text: typeof text === 'string' ? text : text.text, enabled: true })), enabled: true, version: 1 }, base);
      continue;
    }
    result[role] = normalize(role, {
      title: row.title,
      roleLabel: row.roleLabel,
      updatedAt: row.updatedAt,
      enabled: row.enabled !== 'false',
      intro: row.intro,
      items: parseJson<ManagedRuleItem[]>(row.itemsJson, []),
      futurePlanRequired: row.futurePlanRequired === 'true',
      futurePlanOptions: parseJson(row.futurePlanOptionsJson, []),
      version: Number(row.version) || 1,
      updatedBy: row.updatedBy,
      updatedAtIso: row.updatedAtIso,
    } as Partial<ManagedRuleSet>, base);
  }
  return result;
}

export async function saveManagedRule(role: RuleRole, incoming: Partial<ManagedRuleSet>, editorEmail: string) {
  const all = await getManagedRules();
  const previous = all[role];
  const updatedAtIso = new Date().toISOString();
  const next = { ...normalize(role, { ...incoming, updatedAt: updatedAtIso.slice(0, 10), version: previous.version + 1 }, RULES[role]), updatedBy: editorEmail, updatedAtIso };
  if (!next.title || !next.roleLabel || next.items.length === 0) throw new Error('กรุณาระบุชื่อกฎ บทบาท และอย่างน้อยหนึ่งข้อ');
  if (!next.items.some((item) => item.enabled)) throw new Error('ต้องเปิดแสดงกฎอย่างน้อยหนึ่งข้อ');
  if (role !== 'Teacher' && next.futurePlanRequired) {
    if (!next.items[next.items.length - 1]?.enabled) throw new Error('กรุณาแสดงข้อสุดท้ายไว้ เนื่องจากใช้แสดงคำถามหลังฝึกงาน');
    const values = (next.futurePlanOptions || []).map((option) => option.value);
    if (values.length < 2 || new Set(values).size !== values.length) throw new Error('คำตอบหลังฝึกงานต้องมีอย่างน้อย 2 ตัวเลือกและห้ามซ้ำ');
  }
  const values = RULE_ROLES.map((ruleRole) => {
    const set = ruleRole === role ? next : all[ruleRole];
    return {
      role: ruleRole, title: set.title, roleLabel: set.roleLabel,
      updatedAt: set.updatedAt, enabled: String(set.enabled), intro: set.intro || '',
      itemsJson: JSON.stringify(set.items), futurePlanRequired: String(Boolean(set.futurePlanRequired)),
      futurePlanOptionsJson: JSON.stringify(set.futurePlanOptions || []), version: String(set.version),
      updatedBy: ruleRole === role ? editorEmail : '', updatedAtIso: ruleRole === role ? updatedAtIso : '',
    };
  });
  await replaceTabRows('Rules', values);
  await appendRow('RulesHistory', { timestamp: updatedAtIso, role, version: String(next.version), editorEmail, snapshotJson: JSON.stringify(previous) });
  return next;
}

export async function getRuleAcknowledgement(email: string, role: RuleRole) {
  const normalizedEmail = email.trim().toLowerCase();
  return (await readTab('RuleAcknowledgements')).find((row) => row.email.toLowerCase() === normalizedEmail && row.role === role) || null;
}

export async function saveRuleAcknowledgement(email: string, role: RuleRole, version: number) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await getRuleAcknowledgement(normalizedEmail, role);
  const row = { email: normalizedEmail, role, version: String(version), acknowledgedAt: new Date().toISOString() };
  if (existing) {
    await updateRow('RuleAcknowledgements', existing, row);
  } else {
    await appendRow('RuleAcknowledgements', row);
  }
}

