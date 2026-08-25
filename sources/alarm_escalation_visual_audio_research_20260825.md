# L2 / L3+ 报警视觉与声音升级设计调研

日期：2026-08-25  
适用范围：Well Control System 的浏览器端实时事件提示。本文是产品与实现依据，不把浏览器提示当作独立的应急疏散、联锁或 SIS（安全仪表系统）报警装置。

## 结论（可直接采用）

将显示策略作为一项**版本化、可审计的报警呈现策略**，而不是散落在页面中的 `if (level)` 样式判断。L2 采用受控的视觉吸引；L3 及以上采用更强的视觉吸引加可区分的短促声音。声音只在“新出现的未确认事件”或“级别上升”时触发，绝不能因为轮询、重连、打开页面或历史事件回放而再次播放。

| 后端事件级别 | 默认呈现 | 声音 | 解除/确认后的表现 |
| --- | --- | --- | --- |
| L0–L1 | 正常状态/信息记录；不以报警动画争夺注意力 | 无 | 保留事件历史 |
| L2 | 列表、井卡和相关参数卡同步出现黄色/琥珀色 `L2` 标签与警告图标；新事件进入时做一次有限的柔和光晕/描边脉冲，随后保持静态的活动态 | 无 | 确认后停止脉冲、保留“已确认且活动中”状态；清除后进入历史 |
| L3 | 红色（或项目报警哲学规定的严重色）`L3` 标签、图标、事件行/井卡与关联指标的统一光效；未确认活动态应持续显著可见 | 播放一次短促、脉冲式严重提示音 | 声音可单独静音；确认不应清除仍然活动的视觉状态 |
| L4+ | 与 L3 相同的布局，但用独立且更紧急的视觉/声音模式，且在同屏存在时压过低级别提示 | 播放独立的更急促模式；同一时刻只播放最高级别的一种声音 | 同 L3；若这一级别承担安全功能，必须另行完成安全系统、培训和响应程序验证 |

此矩阵与工业控制实践相符：HSE 要求高优先级报警在高活动量中仍易于辨认、处于操作者视野、颜色/闪烁频率/命名一致，并同时识别条件、受影响装置、行动、优先级、时间和状态；可用声音补强视觉，但必须彼此可分辨、避免在高负荷下分散注意力。HSE 还指出，若同时使用恒定与脉冲/间歇声音，后者应表示更高危险或更紧急干预。[HSE：Control systems—Human interface and alarm processing](https://www.hse.gov.uk/comah/sragtech/techmeascontsyst.htm)

## 建议的交互和防报警疲劳约束

1. **只对状态边沿报警。** 触发条件为 `inactive → active` 或 `Lx → 更高 Lx`，并以稳定的后端事件 ID 去重；更新同一活动事件、页面刷新、重连、切井和初次拉取历史不得产生新声光。Siemens WinCC 的 Horn 也将消息类别、优先级、来源、区域和事件作为声/光信号的筛选条件，并在正常运行时避免让登录前发生的未消失报警重新触发信号。[Siemens WinCC Process Control Manual, Horn](https://cache.industry.siemens.com/dl/files/672/73527672/att_83104/v1/53792130699_en-US.pdf)
2. **合并而非叠加。** 在一个短去重窗口中到达多个 L3+ 时，声音只播放最高优先级的一种；L4 出现后压制 L3 的声音。视觉队列应保留全部事件、以最高级别置顶/first-up，但不要让每一条重复事件独立鸣响。HSE 明确要求在严重扰动下避免 fleeting/repeating alarms 造成操作者超负荷，并提出分组、first-up、压低低等级报警等处理方式。[HSE：Alarm processing](https://www.hse.gov.uk/comah/sragtech/techmeascontsyst.htm)
3. **声音与业务确认分离。** 提供明确的“静音本机提示音”和“确认报警”两种动作；前者只停止本机声响，不改变后端事件状态，后者才调用后端确认接口。设置页还应始终显示声音当前是“已启用/已静音/浏览器阻止”。成熟系统也采用此模式：Rockwell 的报警横幅将 silence 与 acknowledge 分开；Siemens 支持对 horn 单独确认或跨终端协调确认。[Rockwell FactoryTalk status, responses and alarm bell](https://www.rockwellautomation.com/en-id/docs/factorytalk-services-platform/6-60/factorytalk-services-platform-help-ditamap/factorytalk-alarms-and-events-help/alarm-and-event-banner/status-indicators-responses-states.html)；[Siemens WinCC Horn acknowledgement](https://cache.industry.siemens.com/dl/files/672/73527672/att_83104/v1/53792130699_en-US.pdf)
4. **为声音建立可学习的语义。** 初版只需要两种短音型：L3 和 L4+；L4+ 的节奏更密/更急促。不要把“随便提高音量或音高”当作语义，亦不要并发播放多段声音。DeltaV 原生为三个报警优先级提供可听区分；WinCC 要求语音尽量短，并在有多个活动消息时限制同时播放为一个、优先输出最高优先级。[Emerson DeltaV Alarm Operations](https://www.emerson.com/is/content/emerson/en/systems-and-software/deltav-distributed-control-system-dcs/product-data-sheets/documents/deltav-alarm-operations.pdf)；[Siemens WinCC Horn voice-output limits](https://cache.industry.siemens.com/dl/files/672/73527672/att_83104/v1/53792130699_en-US.pdf)
5. **不要只用颜色或无限闪烁。** 所有状态应同时携带 `L3`/`L4` 文本、图标和状态文案；光效限于报警项与上下文卡片，不对整页做高频闪屏。实际色板、闪烁节奏、音量和重播间隔应由现场环境、听力/视觉可及性测试和报警哲学确定，而非硬编码为安全结论。

Siemens 的 ISA-18.2 报警管理白皮书给出了成熟产品的相邻状态模式：新且未确认的报警使用声、光、符号与闪烁；确认后变为静态的视觉/符号且不再发声；搁置、抑制和停用时不发声（视觉是否保留可配置）。这与上述“新事件/升级才发声，确认后保留静态活动状态”的设计一致。[Siemens Alarm Management white paper](https://support.industry.siemens.com/cs/attachments/109772836/WP_Alarm_Management_ISA_18.pdf)

## 研究依据

### 行业标准与监管方

- [IEC 62682:2022](https://webstore.iec.ch/en/publication/65543) 面向过程工业，覆盖通过控制系统 HMI 呈现给操作者的报警，包含报警/事件日志、历史库和性能指标。因此呈现策略、用户静音/确认行为及其版本应可追溯，而非只保留前端瞬时状态。
- [ISA-18 系列官方说明](https://www.isa.org/standards-and-publications/isa-standards/isa-18-series-of-standards) 将报警哲学、优先级、合理化、HMI 设计与持续性能监控纳入生命周期；ISA-18.1 处理含视觉与可听设备的 annunciator 序列。这意味着“L2/L3”的真正含义应由已记录的报警哲学决定。
- [EEMUA 对 Alarm Priority 的定义](https://www.eemua.org/glossary/a/alarm-priority)：优先级应由不响应时的后果和可用响应时间共同确定。因此不能仅按算法来源或 UI 紧急感给事件升级；应先确认 L2、L3、L4 与井控响应时间/后果的映射。
- [HSE Alarm management](https://www.hse.gov.uk/humanfactors/topics/alarm-management.htm) 的基本原则是：报警应把注意力引向需要及时评估/行动的工况、提示并指导行动、每项报警有定义的响应且留有足够响应时间，并顾及人的能力和限制。
- [ISO 7731:2003](https://www.iso.org/standard/33590.html) 规定工作区域听觉危险信号的物理设计原则、人体工学要求和测试方法（2022 年复审确认仍有效）。若浏览器声音以后连接现场危险信号，应按该类标准进行环境声学与可感知性验证，不能仅凭桌面扬声器试听。
- 对真正的紧急员工报警， [OSHA 29 CFR 1910.165](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.165) 要求信号高于环境噪声/光线可感知且可识别；这进一步说明 Web 声音只能是操作员辅助，不能替代现场应急报警设计。

### 同行评审研究（设计边界）

- Rayo 等在 *Ergonomics* 的受试研究发现，使用音色表达类别、明确编码预期紧急度且提高声音异质性的报警集合，在识别正确率、类别识别和紧急度匹配上优于对照集合。[论文摘要与 DOI：10.1080/00140139.2019.1676473](https://pubmed.ncbi.nlm.nih.gov/31587607/)。因此至少应让 L3 与 L4+ 有可区分且经过用户学习/试听的声音，而不是同一提示音加音量。
- Guillaume 等在 *Journal of Experimental Psychology: Applied* 的三项实验显示，听觉序列的声学参数会改变紧急度感知，但设计还必须考虑操作者形成的心理表征。[论文摘要与 DOI：10.1037/1076-898X.9.3.196](https://pubmed.ncbi.nlm.nih.gov/14570513/)。故声音样式应在设置页提供“试听”，并在培训/帮助中明确对应的行动含义。
- 过程控制的高保真、有人在环研究显示，报警合理化与状态型智能报警降低操作者工作负荷并提升异常工况表现；它支持“事件去重、合并、按工况抑制”，而非单纯增加效果。[*Applied Ergonomics*, 2022, DOI: 10.1016/j.apergo.2021.103670](https://www.sciencedirect.com/science/article/pii/S0003687021003173)。
- 多模态提示可减少漏检，但实验中也被评价为更紧急、更令人烦扰。[ *Applied Ergonomics*, 2025, DOI: 10.1016/j.apergo.2025.104517](https://www.sciencedirect.com/science/article/abs/pii/S0003687025000535)。这不是“所有报警都加声音”的依据，恰好支持仅为 L3+ 启用可控声音。

## 前端与后端契约建议

### 事件消费方

报警音效模块至少应以以下字段作为输入：`eventId`（稳定且跨轮询一致）、`currentLevel`、`previousLevel`、`isActive`、`ackStatus`、`occurredAt`/`updatedAt`。只在新的活动 `eventId` 或等级上升时调用 `notify(level)`；将已经播放的 `{eventId, level}` 保存在会话内去重表。后端若有 `peakLevel`，可用于视觉显示“峰 Lx”，但不能因峰值历史反复播放声音。

### 持久化策略

将“出口流量为开度还是实际计量”的业务设置与报警呈现设置分开保存，避免一个开关同时影响算法语义和用户个人声音偏好。建议至少区分：

```text
site / well alarm-presentation policy (服务端、版本化、受权限控制)
  - L2/L3/L4 的视觉模式、声音模式、去重窗口、重播/合并规则
  - policyVersion、修改人、修改时间、变更理由

user notification preference (服务端持久化，可按终端覆写)
  - audibleEnabled、volume、lastTestedAt
  - silentUntil（若支持临时静音）、浏览器音频不可用状态
```

安全相关级别的策略变更应纳入管理变更和审计；用户个人只能改变本机是否发声，不能改变事件的后端等级、确认状态或审计记录。浏览器自动播放可能在首次用户交互前被拦截，因此设置页须提供“启用声音/播放测试音”按钮并在失败时明确提示，不能假设 L3+ 已经可靠发声。

## 上线前验收

1. 用同一事件 ID 验证轮询、刷新、重连、切换井不会重复鸣响；新事件和升级事件各只鸣响一次。
2. 同时制造多条 L3/L4，验证只播放最高级别一种声音、事件列表仍保留完整时间线。
3. 验证静音不会调用确认接口；确认和清除后视觉状态正确变化，并有操作日志。
4. 验证深色/浅色主题、色觉缺陷场景、`prefers-reduced-motion` 以及浏览器拒绝自动播放时，L2/L3+ 仍可通过文字、图标和状态识别。
5. 让实际井控操作员在典型噪声、并发事件和高负荷演练中试听并确认 L3/L4 含义、音量和节奏；根据报警率、确认/响应时间、静音率和投诉率调整策略。
