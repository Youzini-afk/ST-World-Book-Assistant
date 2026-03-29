/**
 * Composable: AI Worldbook Config
 * - System prompt builder for config generation
 * - Config generation via AI (parse JSON response)
 * - Config apply (diff preview → batch update)
 */

import { ref, type Ref } from 'vue';
import type { PersistedState } from '../types';

// ── ConfigChange type (local to this composable) ────────────────────
export interface ConfigChange {
  name: string;
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  selected: boolean;
  apply: (entry: WorldbookEntry) => void;
}

export interface UseAIConfigOptions {
  persistedState: Ref<PersistedState>;
  buildCustomApiForGenerate: () => { custom_api?: CustomApiConfig };
  loadWorldbook: (name: string) => Promise<void>;
  setStatus: (msg: string) => void;
}

export interface UseAIConfigReturn {
  aiConfigInput: Ref<string>;
  aiConfigChanges: Ref<ConfigChange[]>;
  aiConfigPreview: Ref<boolean>;
  aiConfigGenerating: Ref<boolean>;
  aiConfigTargetWorldbook: Ref<string>;
  aiConfigCustomPrompt: Ref<string>;

  buildConfigSystemPrompt: (entries: WorldbookEntry[], forceDefault?: boolean) => string;
  loadDefaultConfigPrompt: () => Promise<void>;
  aiConfigGenerate: () => Promise<void>;
  aiConfigApply: () => Promise<void>;
}

const POSITION_TYPE_LABELS: Record<string, string> = {
  before_character_definition: '角色定义之前',
  after_character_definition: '角色定义之后',
  before_example_messages: '示例消息前（↑EM）',
  after_example_messages: '示例消息后（↓EM）',
  before_author_note: '作者注释之前',
  after_author_note: '作者注释之后',
  at_depth: '@D 在深度',
};

const STRATEGY_TYPE_LABELS: Record<string, string> = {
  constant: '蓝灯（常驻）',
  selective: '绿灯（关键词）',
  vectorized: '向量化',
};

export function useAIConfig(options: UseAIConfigOptions): UseAIConfigReturn {
  const { buildCustomApiForGenerate, loadWorldbook } = options;

  // ── State ──────────────────────────────────────────────────────────
  const aiConfigInput = ref('');
  const aiConfigChanges = ref<ConfigChange[]>([]);
  const aiConfigPreview = ref(false);
  const aiConfigGenerating = ref(false);
  const aiConfigTargetWorldbook = ref('');
  const aiConfigCustomPrompt = ref('');

  // ── System prompt builder ─────────────────────────────────────────
  function buildConfigSystemPrompt(entries: WorldbookEntry[], forceDefault = false): string {
    if (!forceDefault && aiConfigCustomPrompt.value.trim()) {
      return aiConfigCustomPrompt.value;
    }
    const names = [...new Set(entries.map(e => e.name))].map(n => `"${n}"`).join(', ');

    return `你是世界书条目配置助手。根据用户的自然语言指令，输出对应的JSON配置。

## 可用条目
${names || '无'}

## JSON Schema
每个配置对象的可用字段如下（只包含需要修改的字段，name必填）：
{
  "name": "str! 必须精确匹配上方条目名",
  "new_name": "str 重命名条目",
  "enabled": "bool",
  "strategy_type": "constant(蓝灯常驻) | selective(绿灯关键词)",
  "keys": ["str 主要关键词"],
  "keys_secondary": ["str 次要关键词"],
  "keys_secondary_logic": "and_any | and_all | not_all | not_any",
  "scan_depth": "int | 'same_as_global'",
  "position_type": "before_character_definition(角色定义之前) | after_character_definition(角色定义之后) | before_example_messages(示例消息前) | after_example_messages(示例消息后) | before_author_note(作者注释之前) | after_author_note(作者注释之后) | at_depth(指定深度)",
  "position_order": "int 排序顺序",
  "position_depth": "int 深度(at_depth时)",
  "position_role": "system | assistant | user",
  "prevent_incoming": "bool 不可递归",
  "prevent_outgoing": "bool 防止进一步递归",
  "probability": "int 0-100",
  "sticky": "int|null 黏性",
  "cooldown": "int|null 冷却"
}

## 思考步骤（内部思考，不要输出思考过程，直接输出结果）
1. 识别用户提到了哪些条目（精确匹配"可用条目"中的名称）
2. 识别每个条目需要修改什么设置（蓝灯/绿灯、位置、顺序、递归等）
3. 如果用户给条目起了新名字，使用new_name字段
4. 只输出有变更的字段，不要输出未提及的字段
5. 注意：同名条目只需写一次，修改会自动应用到所有同名条目

## 输出格式
将结果包裹在 <worldbook_config></worldbook_config> 中，内容为纯JSON数组，无注释无markdown。

<worldbook_config>
[{"name":"现有条目名","new_name":"新名字","strategy_type":"constant","position_type":"before_character_definition","position_order":1,"prevent_incoming":true,"prevent_outgoing":true}]
</worldbook_config>`;
  }

  async function loadDefaultConfigPrompt(): Promise<void> {
    const targetName = aiConfigTargetWorldbook.value;
    if (!targetName) {
      toastr.warning('请先选择目标世界书');
      return;
    }
    try {
      const entries = await getWorldbook(targetName);
      aiConfigCustomPrompt.value = buildConfigSystemPrompt(entries, true);
    } catch (e) {
      toastr.error('加载失败');
    }
  }

  // ── Generate config ───────────────────────────────────────────────
  async function aiConfigGenerate(): Promise<void> {
    const input = aiConfigInput.value.trim();
    const targetName = aiConfigTargetWorldbook.value;
    if (!input || !targetName) {
      toastr.warning('请先选择目标世界书并输入配置指令');
      return;
    }
    aiConfigGenerating.value = true;
    try {
      const existingEntries = await getWorldbook(targetName);
      const systemPrompt = buildConfigSystemPrompt(existingEntries);

      const result = await generateRaw({
        user_input: input,
        should_silence: true,
        ordered_prompts: [
          { role: 'system', content: systemPrompt },
          'user_input',
        ],
        ...buildCustomApiForGenerate(),
      });

      // Strip thinking blocks
      const cleaned = result
        .replace(/<(?:thinking|Think)[\s\S]*?<\/(?:thinking|Think)>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

      // Parse <worldbook_config> tag
      let jsonStr = '';
      const startTag = '<worldbook_config>';
      const endTag = '</worldbook_config>';
      const lastStart = cleaned.lastIndexOf(startTag);
      const lastEnd = cleaned.lastIndexOf(endTag);
      if (lastStart !== -1 && lastEnd !== -1 && lastEnd > lastStart) {
        jsonStr = cleaned.substring(lastStart + startTag.length, lastEnd).trim();
      } else {
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1];
        } else {
          const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*?"name"[\s\S]*?\}\s*\]/);
          if (arrayMatch) {
            jsonStr = arrayMatch[0];
          } else {
            console.error('[AI Config] No JSON found in response:\n', result);
            toastr.error(`① AI 未返回有效 JSON。AI 响应长度: ${result.length} 字符。请检查 API 设置或重试`);
            return;
          }
        }
      }

      // Clean up common AI formatting issues
      jsonStr = jsonStr
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();

      let configs: any[];
      try {
        configs = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error('[AI Config] JSON parse error:', parseErr, '\nCleaned JSON:', jsonStr, '\nFull response:\n', result);
        toastr.error(`② JSON 格式错误: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\n请在控制台(F12)查看 [AI Config] 了解详情`);
        return;
      }
      if (!Array.isArray(configs) || configs.length === 0) {
        toastr.info('AI 返回的配置与当前一致，无需变更（AI 可能未理解指令，可尝试更明确的描述）');
        return;
      }

      // Build ConfigChange[] by diffing
      const changes: ConfigChange[] = [];

      for (const cfg of configs) {
        const name = cfg.name;
        if (!name) continue;
        const matchedEntries = existingEntries.filter(e => e.name === name);
        if (matchedEntries.length === 0) {
          toastr.warning(`条目 "${name}" 在世界书中不存在，已跳过`);
          continue;
        }
        const entry = matchedEntries[0];

        if (cfg.strategy_type !== undefined && cfg.strategy_type !== entry.strategy.type) {
          const oldLabel = STRATEGY_TYPE_LABELS[entry.strategy.type] || entry.strategy.type;
          const newLabel = STRATEGY_TYPE_LABELS[cfg.strategy_type] || cfg.strategy_type;
          changes.push({ name, field: 'strategy_type', label: '激活策略', oldValue: oldLabel, newValue: newLabel, selected: true, apply: e => { e.strategy.type = cfg.strategy_type; } });
        }

        if (cfg.keys !== undefined) {
          const oldKeys = entry.strategy.keys.map(k => String(k)).join(', ') || '（无）';
          const newKeys = cfg.keys.join(', ') || '（无）';
          if (oldKeys !== newKeys) {
            changes.push({ name, field: 'keys', label: '主要关键词', oldValue: oldKeys, newValue: newKeys, selected: true, apply: e => { e.strategy.keys = cfg.keys; } });
          }
        }

        if (cfg.keys_secondary !== undefined) {
          const oldSecKeys = entry.strategy.keys_secondary.keys.map(k => String(k)).join(', ') || '（无）';
          const newSecKeys = cfg.keys_secondary.join(', ') || '（无）';
          if (oldSecKeys !== newSecKeys) {
            changes.push({ name, field: 'keys_secondary', label: '次要关键词', oldValue: oldSecKeys, newValue: newSecKeys, selected: true, apply: e => { e.strategy.keys_secondary.keys = cfg.keys_secondary; } });
          }
        }

        if (cfg.keys_secondary_logic !== undefined && cfg.keys_secondary_logic !== entry.strategy.keys_secondary.logic) {
          changes.push({ name, field: 'keys_secondary_logic', label: '次要关键词逻辑', oldValue: entry.strategy.keys_secondary.logic, newValue: cfg.keys_secondary_logic, selected: true, apply: e => { e.strategy.keys_secondary.logic = cfg.keys_secondary_logic; } });
        }

        if (cfg.scan_depth !== undefined) {
          const oldSd = String(entry.strategy.scan_depth);
          const newSd = String(cfg.scan_depth);
          if (oldSd !== newSd) {
            changes.push({ name, field: 'scan_depth', label: '扫描深度', oldValue: oldSd, newValue: newSd, selected: true, apply: e => { e.strategy.scan_depth = cfg.scan_depth === 'same_as_global' ? 'same_as_global' : Number(cfg.scan_depth); } });
          }
        }

        if (cfg.position_type !== undefined && cfg.position_type !== entry.position.type) {
          const oldLabel = POSITION_TYPE_LABELS[entry.position.type] || entry.position.type;
          const newLabel = POSITION_TYPE_LABELS[cfg.position_type] || cfg.position_type;
          changes.push({ name, field: 'position_type', label: '插入位置', oldValue: oldLabel, newValue: newLabel, selected: true, apply: e => { e.position.type = cfg.position_type; } });
        }

        if (cfg.position_order !== undefined && cfg.position_order !== entry.position.order) {
          changes.push({ name, field: 'position_order', label: '顺序', oldValue: String(entry.position.order), newValue: String(cfg.position_order), selected: true, apply: e => { e.position.order = cfg.position_order; } });
        }

        if (cfg.position_depth !== undefined && cfg.position_depth !== entry.position.depth) {
          changes.push({ name, field: 'position_depth', label: '深度', oldValue: String(entry.position.depth), newValue: String(cfg.position_depth), selected: true, apply: e => { e.position.depth = cfg.position_depth; } });
        }

        if (cfg.position_role !== undefined && cfg.position_role !== entry.position.role) {
          changes.push({ name, field: 'position_role', label: '角色', oldValue: entry.position.role, newValue: cfg.position_role, selected: true, apply: e => { e.position.role = cfg.position_role; } });
        }

        if (cfg.prevent_incoming !== undefined && cfg.prevent_incoming !== entry.recursion.prevent_incoming) {
          changes.push({ name, field: 'prevent_incoming', label: '不可递归', oldValue: entry.recursion.prevent_incoming ? '是' : '否', newValue: cfg.prevent_incoming ? '是' : '否', selected: true, apply: e => { e.recursion.prevent_incoming = cfg.prevent_incoming; } });
        }

        if (cfg.prevent_outgoing !== undefined && cfg.prevent_outgoing !== entry.recursion.prevent_outgoing) {
          changes.push({ name, field: 'prevent_outgoing', label: '防止进一步递归', oldValue: entry.recursion.prevent_outgoing ? '是' : '否', newValue: cfg.prevent_outgoing ? '是' : '否', selected: true, apply: e => { e.recursion.prevent_outgoing = cfg.prevent_outgoing; } });
        }

        if (cfg.new_name !== undefined && cfg.new_name !== entry.name) {
          changes.push({ name, field: 'new_name', label: '条目名称', oldValue: entry.name, newValue: cfg.new_name, selected: true, apply: e => { e.name = cfg.new_name; } });
        }

        if (cfg.enabled !== undefined && cfg.enabled !== entry.enabled) {
          changes.push({ name, field: 'enabled', label: '启用', oldValue: entry.enabled ? '是' : '否', newValue: cfg.enabled ? '是' : '否', selected: true, apply: e => { e.enabled = cfg.enabled; } });
        }

        if (cfg.probability !== undefined && cfg.probability !== entry.probability) {
          changes.push({ name, field: 'probability', label: '激活概率%', oldValue: String(entry.probability), newValue: String(cfg.probability), selected: true, apply: e => { e.probability = cfg.probability; } });
        }

        if (cfg.sticky !== undefined && cfg.sticky !== entry.effect.sticky) {
          changes.push({ name, field: 'sticky', label: '黏性', oldValue: String(entry.effect.sticky ?? '无'), newValue: String(cfg.sticky ?? '无'), selected: true, apply: e => { e.effect.sticky = cfg.sticky; } });
        }

        if (cfg.cooldown !== undefined && cfg.cooldown !== entry.effect.cooldown) {
          changes.push({ name, field: 'cooldown', label: '冷却', oldValue: String(entry.effect.cooldown ?? '无'), newValue: String(cfg.cooldown ?? '无'), selected: true, apply: e => { e.effect.cooldown = cfg.cooldown; } });
        }
      }

      if (changes.length === 0) {
        toastr.info('③ 解析完成但无实际变更 — AI 返回的配置与当前完全一致');
        return;
      }

      aiConfigChanges.value = changes;
      aiConfigPreview.value = true;
      toastr.success(`解析到 ${changes.length} 项变更`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[AI Config] Generation failed:', error);
      toastr.error(`AI 生成失败: ${msg}`);
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        toastr.warning('可能是网络问题或 API 配置有误，请检查 ⚙️ API 设置');
      }
    } finally {
      aiConfigGenerating.value = false;
    }
  }

  // ── Apply config ──────────────────────────────────────────────────
  async function aiConfigApply(): Promise<void> {
    const targetName = aiConfigTargetWorldbook.value;
    const selected = aiConfigChanges.value.filter(c => c.selected);
    if (!targetName || selected.length === 0) return;

    try {
      await updateWorldbookWith(targetName, entries => {
        for (const change of selected) {
          const matched = entries.filter(e => e.name === change.name);
          for (const entry of matched) {
            change.apply(entry);
          }
        }
        return entries;
      });
      aiConfigPreview.value = false;
      aiConfigChanges.value = [];
      toastr.success(`已应用 ${selected.length} 项配置变更`);
      await loadWorldbook(targetName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toastr.error(`应用配置失败: ${msg}`);
    }
  }

  return {
    aiConfigInput,
    aiConfigChanges,
    aiConfigPreview,
    aiConfigGenerating,
    aiConfigTargetWorldbook,
    aiConfigCustomPrompt,

    buildConfigSystemPrompt,
    loadDefaultConfigPrompt,
    aiConfigGenerate,
    aiConfigApply,
  };
}
