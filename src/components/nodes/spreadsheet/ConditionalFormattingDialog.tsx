// ═══════════════════════════════════════════════════════════
// ConditionalFormattingDialog - Manage conditional formatting rules
// Full Google Sheets/Excel style dialog
// ═══════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react'
import {
  LuPlus,
  LuTrash2,
  LuX,
  LuChevronDown,
  LuChevronUp,
  LuGripVertical,
  LuPalette,
  LuChartBar,
  LuPaintBucket,
} from 'react-icons/lu'
import {
  ConditionalFormatRule,
  ConditionalFormatType,
  CellRange,
  CellStyle,
  ColorScaleConfig,
  DataBarConfig,
  cellAddress,
} from './types'
import './ConditionalFormattingDialog.css'

interface ConditionalFormattingDialogProps {
  isDark: boolean
  rules: ConditionalFormatRule[]
  currentSelection: CellRange | null
  onAddRule: (rule: Omit<ConditionalFormatRule, 'id' | 'priority'>) => void
  onUpdateRule: (id: string, updates: Partial<ConditionalFormatRule>) => void
  onDeleteRule: (id: string) => void
  onClose: () => void
}

type RuleCategory = 'cell' | 'text' | 'topBottom' | 'colorScale' | 'dataBar'

interface RuleTypeOption {
  value: ConditionalFormatType
  label: string
  category: RuleCategory
  needsValue?: boolean
  needsValue2?: boolean
  needsRank?: boolean
}

const RULE_TYPE_OPTIONS: RuleTypeOption[] = [
  // Cell value rules
  { value: 'greaterThan', label: 'Greater than', category: 'cell', needsValue: true },
  { value: 'lessThan', label: 'Less than', category: 'cell', needsValue: true },
  { value: 'greaterThanOrEqual', label: 'Greater than or equal to', category: 'cell', needsValue: true },
  { value: 'lessThanOrEqual', label: 'Less than or equal to', category: 'cell', needsValue: true },
  { value: 'equals', label: 'Equal to', category: 'cell', needsValue: true },
  { value: 'notEquals', label: 'Not equal to', category: 'cell', needsValue: true },
  { value: 'between', label: 'Between', category: 'cell', needsValue: true, needsValue2: true },
  { value: 'notBetween', label: 'Not between', category: 'cell', needsValue: true, needsValue2: true },
  { value: 'blank', label: 'Is blank', category: 'cell' },
  { value: 'notBlank', label: 'Is not blank', category: 'cell' },
  // Text rules
  { value: 'textContains', label: 'Text contains', category: 'text', needsValue: true },
  { value: 'textNotContains', label: 'Text does not contain', category: 'text', needsValue: true },
  { value: 'textStartsWith', label: 'Text starts with', category: 'text', needsValue: true },
  { value: 'textEndsWith', label: 'Text ends with', category: 'text', needsValue: true },
  { value: 'duplicate', label: 'Duplicate values', category: 'text' },
  { value: 'unique', label: 'Unique values', category: 'text' },
  // Top/bottom rules
  { value: 'top10', label: 'Top N values', category: 'topBottom', needsRank: true },
  { value: 'bottom10', label: 'Bottom N values', category: 'topBottom', needsRank: true },
  { value: 'aboveAverage', label: 'Above average', category: 'topBottom' },
  { value: 'belowAverage', label: 'Below average', category: 'topBottom' },
  // Color scale
  { value: 'colorScale', label: 'Color Scale', category: 'colorScale' },
  // Data bar
  { value: 'dataBar', label: 'Data Bar', category: 'dataBar' },
]

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#64748B', '#1E293B', '#FFFFFF',
]

const formatRangeDisplay = (ranges: CellRange[]): string => {
  return ranges.map(r => {
    const start = cellAddress(r.start.row, r.start.col)
    const end = cellAddress(r.end.row, r.end.col)
    return start === end ? start : `${start}:${end}`
  }).join(', ')
}

const ConditionalFormattingDialog: React.FC<ConditionalFormattingDialogProps> = ({
  isDark,
  rules,
  currentSelection,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'new'>('rules')
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)

  // New rule state
  const [newRuleType, setNewRuleType] = useState<ConditionalFormatType>('greaterThan')
  const [newRuleValue, setNewRuleValue] = useState('')
  const [newRuleValue2, setNewRuleValue2] = useState('')
  const [newRuleRank, setNewRuleRank] = useState(10)
  const [newRulePercent, setNewRulePercent] = useState(false)
  const [newRuleStyle, setNewRuleStyle] = useState<CellStyle>({
    backgroundColor: '#22C55E',
    color: '#FFFFFF',
    fontWeight: 'bold',
  })
  const [newColorScale, setNewColorScale] = useState<ColorScaleConfig>({
    minColor: '#F87171',
    midColor: '#FCD34D',
    maxColor: '#4ADE80',
    minType: 'min',
    midType: 'percent',
    maxType: 'max',
    midValue: 50,
  })
  const [newDataBar, setNewDataBar] = useState<DataBarConfig>({
    color: '#3B82F6',
    showValue: true,
    minType: 'min',
    maxType: 'max',
  })

  const selectedRuleOption = useMemo(() =>
    RULE_TYPE_OPTIONS.find(o => o.value === newRuleType),
    [newRuleType]
  )

  const sortedRules = useMemo(() =>
    [...rules].sort((a, b) => a.priority - b.priority),
    [rules]
  )

  const handleAddRule = useCallback(() => {
    if (!currentSelection) return

    const baseRule: Omit<ConditionalFormatRule, 'id' | 'priority'> = {
      ranges: [currentSelection],
      type: newRuleType,
    }

    // Add value fields based on rule type
    if (selectedRuleOption?.needsValue) {
      baseRule.value = isNaN(Number(newRuleValue)) ? newRuleValue : Number(newRuleValue)
    }
    if (selectedRuleOption?.needsValue2) {
      baseRule.value2 = isNaN(Number(newRuleValue2)) ? newRuleValue2 : Number(newRuleValue2)
    }
    if (selectedRuleOption?.needsRank) {
      baseRule.rank = newRuleRank
      baseRule.percent = newRulePercent
    }

    // Add style/config based on category
    if (selectedRuleOption?.category === 'colorScale') {
      baseRule.colorScale = newColorScale
    } else if (selectedRuleOption?.category === 'dataBar') {
      baseRule.dataBar = newDataBar
    } else {
      baseRule.style = newRuleStyle
    }

    onAddRule(baseRule)
    setActiveTab('rules')

    // Reset form
    setNewRuleValue('')
    setNewRuleValue2('')
  }, [currentSelection, newRuleType, newRuleValue, newRuleValue2, newRuleRank, newRulePercent, newRuleStyle, newColorScale, newDataBar, selectedRuleOption, onAddRule])

  const handleMoveRule = useCallback((ruleId: string, direction: 'up' | 'down') => {
    const index = sortedRules.findIndex(r => r.id === ruleId)
    if (index === -1) return

    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sortedRules.length) return

    const currentPriority = sortedRules[index].priority
    const swapPriority = sortedRules[swapIndex].priority

    onUpdateRule(sortedRules[index].id, { priority: swapPriority })
    onUpdateRule(sortedRules[swapIndex].id, { priority: currentPriority })
  }, [sortedRules, onUpdateRule])

  const getRuleDescription = useCallback((rule: ConditionalFormatRule): string => {
    const option = RULE_TYPE_OPTIONS.find(o => o.value === rule.type)
    if (!option) return rule.type

    switch (rule.type) {
      case 'greaterThan':
      case 'lessThan':
      case 'greaterThanOrEqual':
      case 'lessThanOrEqual':
      case 'equals':
      case 'notEquals':
        return `${option.label} ${rule.value}`
      case 'between':
        return `${option.label} ${rule.value} and ${rule.value2}`
      case 'notBetween':
        return `${option.label} ${rule.value} and ${rule.value2}`
      case 'textContains':
      case 'textNotContains':
      case 'textStartsWith':
      case 'textEndsWith':
        return `${option.label} "${rule.value}"`
      case 'top10':
      case 'bottom10':
        return `${option.label.replace('N', String(rule.rank || 10))}${rule.percent ? ' (%)' : ''}`
      case 'colorScale':
        return 'Color Scale'
      case 'dataBar':
        return 'Data Bar'
      default:
        return option.label
    }
  }, [])

  const renderColorPicker = (
    label: string,
    value: string,
    onChange: (color: string) => void
  ) => (
    <div className="cf-dialog__color-field">
      <label className="cf-dialog__label">{label}</label>
      <div className="cf-dialog__color-picker">
        <div
          className="cf-dialog__color-preview"
          style={{ backgroundColor: value }}
        />
        <div className="cf-dialog__color-palette">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              className={`cf-dialog__color-swatch ${value === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
        <input
          type="text"
          className="cf-dialog__input cf-dialog__input--small"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  )

  return (
    <div className={`cf-dialog-overlay ${isDark ? 'cf-dialog--dark' : 'cf-dialog--light'}`}>
      <div className="cf-dialog">
        {/* Header */}
        <div className="cf-dialog__header">
          <div className="cf-dialog__header-icon">
            <LuPalette size={20} />
          </div>
          <h2 className="cf-dialog__title">Conditional Formatting</h2>
          <button className="cf-dialog__close" onClick={onClose}>
            <LuX size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="cf-dialog__tabs">
          <button
            className={`cf-dialog__tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            Rules ({rules.length})
          </button>
          <button
            className={`cf-dialog__tab ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            <LuPlus size={14} /> Add Rule
          </button>
        </div>

        {/* Content */}
        <div className="cf-dialog__content">
          {activeTab === 'rules' ? (
            <div className="cf-dialog__rules-list">
              {sortedRules.length === 0 ? (
                <div className="cf-dialog__empty">
                  <LuPalette size={32} />
                  <p>No conditional formatting rules</p>
                  <button
                    className="cf-dialog__btn cf-dialog__btn--primary"
                    onClick={() => setActiveTab('new')}
                  >
                    <LuPlus size={14} /> Add Rule
                  </button>
                </div>
              ) : (
                sortedRules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className={`cf-dialog__rule ${expandedRuleId === rule.id ? 'expanded' : ''}`}
                  >
                    <div
                      className="cf-dialog__rule-header"
                      onClick={() => setExpandedRuleId(
                        expandedRuleId === rule.id ? null : rule.id
                      )}
                    >
                      <div className="cf-dialog__rule-drag">
                        <LuGripVertical size={14} />
                      </div>
                      <div className="cf-dialog__rule-preview">
                        {rule.type === 'colorScale' && rule.colorScale ? (
                          <div
                            className="cf-dialog__rule-gradient"
                            style={{
                              background: `linear-gradient(to right, ${rule.colorScale.minColor}, ${rule.colorScale.midColor || rule.colorScale.maxColor}, ${rule.colorScale.maxColor})`
                            }}
                          />
                        ) : rule.type === 'dataBar' && rule.dataBar ? (
                          <div className="cf-dialog__rule-bar">
                            <div
                              className="cf-dialog__rule-bar-fill"
                              style={{ backgroundColor: rule.dataBar.color, width: '60%' }}
                            />
                          </div>
                        ) : (
                          <div
                            className="cf-dialog__rule-style"
                            style={{
                              backgroundColor: rule.style?.backgroundColor || '#22C55E',
                              color: rule.style?.color || '#fff',
                              fontWeight: rule.style?.fontWeight,
                            }}
                          >
                            Aa
                          </div>
                        )}
                      </div>
                      <div className="cf-dialog__rule-info">
                        <span className="cf-dialog__rule-desc">
                          {getRuleDescription(rule)}
                        </span>
                        <span className="cf-dialog__rule-range">
                          {formatRangeDisplay(rule.ranges)}
                        </span>
                      </div>
                      <div className="cf-dialog__rule-actions">
                        <button
                          className="cf-dialog__icon-btn"
                          onClick={(e) => { e.stopPropagation(); handleMoveRule(rule.id, 'up') }}
                          disabled={index === 0}
                          title="Move up (higher priority)"
                        >
                          <LuChevronUp size={14} />
                        </button>
                        <button
                          className="cf-dialog__icon-btn"
                          onClick={(e) => { e.stopPropagation(); handleMoveRule(rule.id, 'down') }}
                          disabled={index === sortedRules.length - 1}
                          title="Move down (lower priority)"
                        >
                          <LuChevronDown size={14} />
                        </button>
                        <button
                          className="cf-dialog__icon-btn cf-dialog__icon-btn--danger"
                          onClick={(e) => { e.stopPropagation(); onDeleteRule(rule.id) }}
                          title="Delete rule"
                        >
                          <LuTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {expandedRuleId === rule.id && (
                      <div className="cf-dialog__rule-details">
                        <p className="cf-dialog__rule-detail-text">
                          Priority: {rule.priority} (lower = evaluated first)
                        </p>
                        {rule.stopIfTrue && (
                          <p className="cf-dialog__rule-detail-text">
                            Stop if true: Yes
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="cf-dialog__new-rule">
              {/* Selection info */}
              <div className="cf-dialog__selection-info">
                <span className="cf-dialog__label">Apply to range:</span>
                <span className="cf-dialog__selection-range">
                  {currentSelection
                    ? formatRangeDisplay([currentSelection])
                    : 'Select cells first'
                  }
                </span>
              </div>

              {/* Rule type selector */}
              <div className="cf-dialog__field">
                <label className="cf-dialog__label">Format cells if...</label>
                <select
                  className="cf-dialog__select"
                  value={newRuleType}
                  onChange={e => setNewRuleType(e.target.value as ConditionalFormatType)}
                >
                  <optgroup label="Cell Value">
                    {RULE_TYPE_OPTIONS.filter(o => o.category === 'cell').map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Text">
                    {RULE_TYPE_OPTIONS.filter(o => o.category === 'text').map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Top/Bottom">
                    {RULE_TYPE_OPTIONS.filter(o => o.category === 'topBottom').map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Visual">
                    {RULE_TYPE_OPTIONS.filter(o => o.category === 'colorScale' || o.category === 'dataBar').map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Value inputs */}
              {selectedRuleOption?.needsValue && (
                <div className="cf-dialog__field">
                  <label className="cf-dialog__label">Value</label>
                  <input
                    type="text"
                    className="cf-dialog__input"
                    value={newRuleValue}
                    onChange={e => setNewRuleValue(e.target.value)}
                    placeholder="Enter value..."
                  />
                </div>
              )}

              {selectedRuleOption?.needsValue2 && (
                <div className="cf-dialog__field">
                  <label className="cf-dialog__label">And</label>
                  <input
                    type="text"
                    className="cf-dialog__input"
                    value={newRuleValue2}
                    onChange={e => setNewRuleValue2(e.target.value)}
                    placeholder="Enter second value..."
                  />
                </div>
              )}

              {selectedRuleOption?.needsRank && (
                <div className="cf-dialog__field-row">
                  <div className="cf-dialog__field">
                    <label className="cf-dialog__label">N =</label>
                    <input
                      type="number"
                      className="cf-dialog__input cf-dialog__input--small"
                      value={newRuleRank}
                      onChange={e => setNewRuleRank(Number(e.target.value))}
                      min={1}
                      max={100}
                    />
                  </div>
                  <label className="cf-dialog__checkbox">
                    <input
                      type="checkbox"
                      checked={newRulePercent}
                      onChange={e => setNewRulePercent(e.target.checked)}
                    />
                    <span>Percent of range</span>
                  </label>
                </div>
              )}

              {/* Style options for standard rules */}
              {selectedRuleOption?.category !== 'colorScale' && selectedRuleOption?.category !== 'dataBar' && (
                <div className="cf-dialog__style-section">
                  <div className="cf-dialog__section-header">
                    <LuPaintBucket size={14} />
                    <span>Formatting Style</span>
                  </div>
                  <div className="cf-dialog__style-preview">
                    <div
                      className="cf-dialog__style-sample"
                      style={{
                        backgroundColor: newRuleStyle.backgroundColor,
                        color: newRuleStyle.color,
                        fontWeight: newRuleStyle.fontWeight,
                        fontStyle: newRuleStyle.fontStyle,
                      }}
                    >
                      Sample Text
                    </div>
                  </div>
                  <div className="cf-dialog__style-options">
                    {renderColorPicker('Fill Color', newRuleStyle.backgroundColor || '#22C55E',
                      (color) => setNewRuleStyle(s => ({ ...s, backgroundColor: color }))
                    )}
                    {renderColorPicker('Text Color', newRuleStyle.color || '#FFFFFF',
                      (color) => setNewRuleStyle(s => ({ ...s, color }))
                    )}
                    <div className="cf-dialog__style-toggles">
                      <button
                        className={`cf-dialog__style-btn ${newRuleStyle.fontWeight === 'bold' ? 'active' : ''}`}
                        onClick={() => setNewRuleStyle(s => ({
                          ...s,
                          fontWeight: s.fontWeight === 'bold' ? 'normal' : 'bold'
                        }))}
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        className={`cf-dialog__style-btn ${newRuleStyle.fontStyle === 'italic' ? 'active' : ''}`}
                        onClick={() => setNewRuleStyle(s => ({
                          ...s,
                          fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic'
                        }))}
                      >
                        <em>I</em>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Color scale options */}
              {selectedRuleOption?.category === 'colorScale' && (
                <div className="cf-dialog__colorscale-section">
                  <div className="cf-dialog__section-header">
                    <LuPalette size={14} />
                    <span>Color Scale</span>
                  </div>
                  <div className="cf-dialog__colorscale-preview">
                    <div
                      className="cf-dialog__gradient-preview"
                      style={{
                        background: `linear-gradient(to right, ${newColorScale.minColor}, ${newColorScale.midColor || newColorScale.maxColor}, ${newColorScale.maxColor})`
                      }}
                    />
                  </div>
                  <div className="cf-dialog__colorscale-options">
                    {renderColorPicker('Min Color', newColorScale.minColor,
                      (color) => setNewColorScale(s => ({ ...s, minColor: color }))
                    )}
                    {renderColorPicker('Mid Color', newColorScale.midColor || '#FCD34D',
                      (color) => setNewColorScale(s => ({ ...s, midColor: color }))
                    )}
                    {renderColorPicker('Max Color', newColorScale.maxColor,
                      (color) => setNewColorScale(s => ({ ...s, maxColor: color }))
                    )}
                  </div>
                </div>
              )}

              {/* Data bar options */}
              {selectedRuleOption?.category === 'dataBar' && (
                <div className="cf-dialog__databar-section">
                  <div className="cf-dialog__section-header">
                    <LuChartBar size={14} />
                    <span>Data Bar</span>
                  </div>
                  <div className="cf-dialog__databar-preview">
                    <div className="cf-dialog__bar-preview">
                      <div
                        className="cf-dialog__bar-fill"
                        style={{ backgroundColor: newDataBar.color, width: '65%' }}
                      />
                      {newDataBar.showValue && <span>65</span>}
                    </div>
                  </div>
                  <div className="cf-dialog__databar-options">
                    {renderColorPicker('Bar Color', newDataBar.color,
                      (color) => setNewDataBar(s => ({ ...s, color }))
                    )}
                    <label className="cf-dialog__checkbox">
                      <input
                        type="checkbox"
                        checked={newDataBar.showValue}
                        onChange={e => setNewDataBar(s => ({ ...s, showValue: e.target.checked }))}
                      />
                      <span>Show value in cell</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Add button */}
              <div className="cf-dialog__actions">
                <button
                  className="cf-dialog__btn cf-dialog__btn--secondary"
                  onClick={() => setActiveTab('rules')}
                >
                  Cancel
                </button>
                <button
                  className="cf-dialog__btn cf-dialog__btn--primary"
                  onClick={handleAddRule}
                  disabled={!currentSelection}
                >
                  <LuPlus size={14} /> Add Rule
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConditionalFormattingDialog
