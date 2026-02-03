// ═══════════════════════════════════════════════════════════
// DataValidationDialog.tsx - Dialog for managing data validation rules
// ═══════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react'
import {
  LuX,
  LuList,
  LuHash,
  LuCalendar,
  LuType,
  LuCode,
  LuPlus,
  LuTrash2,
  LuCircleAlert,
  LuTriangleAlert,
  LuInfo,
  LuCheck,
} from 'react-icons/lu'
import {
  DataValidationRule,
  DataValidationType,
  DataValidationOperator,
  CellRange,
  cellAddress,
} from './types'
import './DataValidationDialog.css'

interface DataValidationDialogProps {
  isDark: boolean
  rules: DataValidationRule[]
  currentSelection: CellRange | null
  onAddRule: (rule: Omit<DataValidationRule, 'id'>) => string
  onUpdateRule: (id: string, updates: Partial<DataValidationRule>) => void
  onDeleteRule: (id: string) => void
  onClose: () => void
}

const validationTypes: { type: DataValidationType; label: string; icon: React.ReactNode }[] = [
  { type: 'list', label: 'Dropdown List', icon: <LuList size={16} /> },
  { type: 'number', label: 'Number', icon: <LuHash size={16} /> },
  { type: 'integer', label: 'Whole Number', icon: <LuHash size={16} /> },
  { type: 'decimal', label: 'Decimal', icon: <LuHash size={16} /> },
  { type: 'date', label: 'Date', icon: <LuCalendar size={16} /> },
  { type: 'textLength', label: 'Text Length', icon: <LuType size={16} /> },
  { type: 'custom', label: 'Custom Formula', icon: <LuCode size={16} /> },
]

const operators: { op: DataValidationOperator; label: string }[] = [
  { op: 'between', label: 'between' },
  { op: 'notBetween', label: 'not between' },
  { op: 'equalTo', label: 'equal to' },
  { op: 'notEqualTo', label: 'not equal to' },
  { op: 'greaterThan', label: 'greater than' },
  { op: 'lessThan', label: 'less than' },
  { op: 'greaterThanOrEqual', label: 'greater than or equal to' },
  { op: 'lessThanOrEqual', label: 'less than or equal to' },
]

const errorStyles: { style: 'stop' | 'warning' | 'info'; label: string; icon: React.ReactNode }[] = [
  { style: 'stop', label: 'Stop', icon: <LuCircleAlert size={14} /> },
  { style: 'warning', label: 'Warning', icon: <LuTriangleAlert size={14} /> },
  { style: 'info', label: 'Info', icon: <LuInfo size={14} /> },
]

const formatRangeDisplay = (range: CellRange): string => {
  const start = cellAddress(range.start.row, range.start.col)
  const end = cellAddress(range.end.row, range.end.col)
  return start === end ? start : `${start}:${end}`
}

export const DataValidationDialog: React.FC<DataValidationDialogProps> = ({
  isDark,
  rules,
  currentSelection,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onClose,
}) => {
  const [editingRule, setEditingRule] = useState<Partial<DataValidationRule> | null>(null)
  const [listItemsText, setListItemsText] = useState('')
  const [activeTab, setActiveTab] = useState<'rules' | 'edit'>('rules')

  // Initialize a new rule
  const handleAddNew = useCallback(() => {
    const ranges = currentSelection ? [currentSelection] : []
    setEditingRule({
      ranges,
      type: 'list',
      listItems: [],
      showDropdown: true,
      allowBlank: true,
      showErrorAlert: true,
      errorStyle: 'stop',
    })
    setListItemsText('')
    setActiveTab('edit')
  }, [currentSelection])

  // Start editing an existing rule
  const handleEditRule = useCallback((rule: DataValidationRule) => {
    setEditingRule({ ...rule })
    setListItemsText(rule.listItems?.join('\n') || '')
    setActiveTab('edit')
  }, [])

  // Save the current rule being edited
  const handleSaveRule = useCallback(() => {
    if (!editingRule || !editingRule.type || !editingRule.ranges?.length) return

    // Update list items from text
    const finalRule = { ...editingRule }
    if (finalRule.type === 'list') {
      finalRule.listItems = listItemsText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    }

    if (editingRule.id) {
      // Update existing rule
      onUpdateRule(editingRule.id, finalRule)
    } else {
      // Add new rule
      onAddRule(finalRule as Omit<DataValidationRule, 'id'>)
    }

    setEditingRule(null)
    setListItemsText('')
    setActiveTab('rules')
  }, [editingRule, listItemsText, onAddRule, onUpdateRule])

  // Delete a rule
  const handleDeleteRule = useCallback((id: string) => {
    onDeleteRule(id)
  }, [onDeleteRule])

  // Update a field on the editing rule
  const updateField = <K extends keyof DataValidationRule>(
    field: K,
    value: DataValidationRule[K]
  ) => {
    if (!editingRule) return
    setEditingRule({ ...editingRule, [field]: value })
  }

  return (
    <div className={`data-validation-dialog ${isDark ? 'data-validation-dialog--dark' : ''}`}>
      <div className="data-validation-dialog__header">
        <h3>Data Validation</h3>
        <button className="data-validation-dialog__close" onClick={onClose}>
          <LuX size={18} />
        </button>
      </div>

      <div className="data-validation-dialog__tabs">
        <button
          className={`data-validation-dialog__tab ${activeTab === 'rules' ? 'data-validation-dialog__tab--active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Rules ({rules.length})
        </button>
        <button
          className={`data-validation-dialog__tab ${activeTab === 'edit' ? 'data-validation-dialog__tab--active' : ''}`}
          onClick={() => editingRule && setActiveTab('edit')}
          disabled={!editingRule}
        >
          {editingRule?.id ? 'Edit Rule' : 'New Rule'}
        </button>
      </div>

      <div className="data-validation-dialog__content">
        {activeTab === 'rules' ? (
          <div className="data-validation-dialog__rules-list">
            {rules.length === 0 ? (
              <div className="data-validation-dialog__empty">
                <p>No data validation rules defined.</p>
                <p>Add a rule to restrict the values that can be entered in cells.</p>
              </div>
            ) : (
              rules.map(rule => (
                <div key={rule.id} className="data-validation-dialog__rule-item">
                  <div className="data-validation-dialog__rule-info">
                    <div className="data-validation-dialog__rule-type">
                      {validationTypes.find(t => t.type === rule.type)?.icon}
                      <span>{validationTypes.find(t => t.type === rule.type)?.label}</span>
                    </div>
                    <div className="data-validation-dialog__rule-ranges">
                      {rule.ranges.map((r, i) => (
                        <span key={i} className="data-validation-dialog__range-badge">
                          {formatRangeDisplay(r)}
                        </span>
                      ))}
                    </div>
                    {rule.type === 'list' && rule.listItems && (
                      <div className="data-validation-dialog__rule-preview">
                        {rule.listItems.slice(0, 3).join(', ')}
                        {rule.listItems.length > 3 && ` +${rule.listItems.length - 3} more`}
                      </div>
                    )}
                    {rule.type !== 'list' && rule.operator && (
                      <div className="data-validation-dialog__rule-preview">
                        {operators.find(o => o.op === rule.operator)?.label} {rule.value1}
                        {rule.operator === 'between' || rule.operator === 'notBetween'
                          ? ` and ${rule.value2}`
                          : ''}
                      </div>
                    )}
                  </div>
                  <div className="data-validation-dialog__rule-actions">
                    <button onClick={() => handleEditRule(rule)} title="Edit rule">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="data-validation-dialog__delete-btn"
                      title="Delete rule"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}

            <button
              className="data-validation-dialog__add-btn"
              onClick={handleAddNew}
            >
              <LuPlus size={16} />
              Add Validation Rule
            </button>
          </div>
        ) : (
          <div className="data-validation-dialog__edit-form">
            {/* Range Selection */}
            <div className="data-validation-dialog__field">
              <label>Apply to Range</label>
              <div className="data-validation-dialog__ranges">
                {editingRule?.ranges?.map((r, i) => (
                  <span key={i} className="data-validation-dialog__range-badge">
                    {formatRangeDisplay(r)}
                  </span>
                ))}
                {(!editingRule?.ranges || editingRule.ranges.length === 0) && (
                  <span className="data-validation-dialog__hint">
                    Select cells before opening this dialog
                  </span>
                )}
              </div>
            </div>

            {/* Validation Type */}
            <div className="data-validation-dialog__field">
              <label>Validation Type</label>
              <div className="data-validation-dialog__type-grid">
                {validationTypes.map(vt => (
                  <button
                    key={vt.type}
                    className={`data-validation-dialog__type-btn ${
                      editingRule?.type === vt.type ? 'data-validation-dialog__type-btn--active' : ''
                    }`}
                    onClick={() => updateField('type', vt.type)}
                  >
                    {vt.icon}
                    <span>{vt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* List Items */}
            {editingRule?.type === 'list' && (
              <div className="data-validation-dialog__field">
                <label>List Items (one per line)</label>
                <textarea
                  className="data-validation-dialog__textarea"
                  value={listItemsText}
                  onChange={e => setListItemsText(e.target.value)}
                  placeholder="Enter dropdown options, one per line..."
                  rows={5}
                />
                <div className="data-validation-dialog__checkbox">
                  <input
                    type="checkbox"
                    id="showDropdown"
                    checked={editingRule.showDropdown !== false}
                    onChange={e => updateField('showDropdown', e.target.checked)}
                  />
                  <label htmlFor="showDropdown">Show dropdown arrow in cell</label>
                </div>
              </div>
            )}

            {/* Numeric/TextLength Operators */}
            {(editingRule?.type === 'number' ||
              editingRule?.type === 'integer' ||
              editingRule?.type === 'decimal' ||
              editingRule?.type === 'textLength') && (
              <>
                <div className="data-validation-dialog__field">
                  <label>Condition</label>
                  <select
                    className="data-validation-dialog__select"
                    value={editingRule.operator || 'between'}
                    onChange={e => updateField('operator', e.target.value as DataValidationOperator)}
                  >
                    {operators.map(op => (
                      <option key={op.op} value={op.op}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="data-validation-dialog__field">
                  <label>
                    {editingRule.operator === 'between' || editingRule.operator === 'notBetween'
                      ? 'Minimum'
                      : 'Value'}
                  </label>
                  <input
                    type="number"
                    className="data-validation-dialog__input"
                    value={editingRule.value1 ?? ''}
                    onChange={e =>
                      updateField('value1', e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    placeholder="Enter value..."
                  />
                </div>

                {(editingRule.operator === 'between' || editingRule.operator === 'notBetween') && (
                  <div className="data-validation-dialog__field">
                    <label>Maximum</label>
                    <input
                      type="number"
                      className="data-validation-dialog__input"
                      value={editingRule.value2 ?? ''}
                      onChange={e =>
                        updateField('value2', e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      placeholder="Enter value..."
                    />
                  </div>
                )}
              </>
            )}

            {/* Custom Formula */}
            {editingRule?.type === 'custom' && (
              <div className="data-validation-dialog__field">
                <label>Custom Formula</label>
                <input
                  type="text"
                  className="data-validation-dialog__input"
                  value={editingRule.formula || ''}
                  onChange={e => updateField('formula', e.target.value)}
                  placeholder="=A1>0"
                />
                <span className="data-validation-dialog__hint">
                  Formula must return TRUE for valid values
                </span>
              </div>
            )}

            {/* Allow Blank */}
            <div className="data-validation-dialog__field">
              <div className="data-validation-dialog__checkbox">
                <input
                  type="checkbox"
                  id="allowBlank"
                  checked={editingRule?.allowBlank !== false}
                  onChange={e => updateField('allowBlank', e.target.checked)}
                />
                <label htmlFor="allowBlank">Allow empty cells</label>
              </div>
            </div>

            {/* Input Message */}
            <div className="data-validation-dialog__section-header">
              <LuInfo size={14} />
              <span>Input Message (optional)</span>
            </div>

            <div className="data-validation-dialog__checkbox">
              <input
                type="checkbox"
                id="showInputMessage"
                checked={editingRule?.showInputMessage || false}
                onChange={e => updateField('showInputMessage', e.target.checked)}
              />
              <label htmlFor="showInputMessage">Show message when cell is selected</label>
            </div>

            {editingRule?.showInputMessage && (
              <>
                <div className="data-validation-dialog__field">
                  <label>Title</label>
                  <input
                    type="text"
                    className="data-validation-dialog__input"
                    value={editingRule.inputTitle || ''}
                    onChange={e => updateField('inputTitle', e.target.value)}
                    placeholder="Input message title..."
                  />
                </div>
                <div className="data-validation-dialog__field">
                  <label>Message</label>
                  <textarea
                    className="data-validation-dialog__textarea"
                    value={editingRule.inputMessage || ''}
                    onChange={e => updateField('inputMessage', e.target.value)}
                    placeholder="Help message to show..."
                    rows={2}
                  />
                </div>
              </>
            )}

            {/* Error Alert */}
            <div className="data-validation-dialog__section-header">
              <LuCircleAlert size={14} />
              <span>Error Alert</span>
            </div>

            <div className="data-validation-dialog__checkbox">
              <input
                type="checkbox"
                id="showErrorAlert"
                checked={editingRule?.showErrorAlert !== false}
                onChange={e => updateField('showErrorAlert', e.target.checked)}
              />
              <label htmlFor="showErrorAlert">Show alert after invalid data is entered</label>
            </div>

            {editingRule?.showErrorAlert !== false && (
              <>
                <div className="data-validation-dialog__field">
                  <label>Error Style</label>
                  <div className="data-validation-dialog__error-styles">
                    {errorStyles.map(es => (
                      <button
                        key={es.style}
                        className={`data-validation-dialog__error-style-btn ${
                          editingRule?.errorStyle === es.style
                            ? 'data-validation-dialog__error-style-btn--active'
                            : ''
                        }`}
                        onClick={() => updateField('errorStyle', es.style)}
                      >
                        {es.icon}
                        <span>{es.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="data-validation-dialog__field">
                  <label>Error Title</label>
                  <input
                    type="text"
                    className="data-validation-dialog__input"
                    value={editingRule?.errorTitle || ''}
                    onChange={e => updateField('errorTitle', e.target.value)}
                    placeholder="Invalid Value"
                  />
                </div>
                <div className="data-validation-dialog__field">
                  <label>Error Message</label>
                  <textarea
                    className="data-validation-dialog__textarea"
                    value={editingRule?.errorMessage || ''}
                    onChange={e => updateField('errorMessage', e.target.value)}
                    placeholder="The value you entered is not valid..."
                    rows={2}
                  />
                </div>
              </>
            )}

            {/* Save/Cancel Buttons */}
            <div className="data-validation-dialog__form-actions">
              <button
                className="data-validation-dialog__cancel-btn"
                onClick={() => {
                  setEditingRule(null)
                  setActiveTab('rules')
                }}
              >
                Cancel
              </button>
              <button
                className="data-validation-dialog__save-btn"
                onClick={handleSaveRule}
                disabled={
                  !editingRule?.type ||
                  !editingRule?.ranges?.length ||
                  (editingRule.type === 'list' && !listItemsText.trim())
                }
              >
                <LuCheck size={16} />
                {editingRule?.id ? 'Update Rule' : 'Add Rule'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DataValidationDialog
