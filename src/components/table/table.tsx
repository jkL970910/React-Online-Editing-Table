import React from "react";
import { Button, Row, Col, Popover, Input, Form, Checkbox, Select, Modal, Radio, message, Drawer } from "antd";
import { ControlOutlined, UndoOutlined, RedoOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { getItemByID, setItemByID } from './utils';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import _, { isInteger, isNumber, toNumber } from 'lodash';
import { CreateColorSchema, EditableTagGroup, TableCodeView, DescriptionBar } from './tableComponents';
import ReactDiffViewer from 'react-diff-viewer';
import './index.css';
import { FormInstance } from 'antd/lib/form';

const table = {};

let originTable = {};

const tableHistory = {};
const historyIndex = {};

let file = [];

interface KaleidoTableProps extends Handsontable.GridSettings {
    uuid: any;
    canvasID: any;
    parentThis: any;
    preConfig: any;
};

class KaleidoTable extends React.Component<KaleidoTableProps> {
    state = {
        saveTable: {},
        updateFile: '',
        schemaType: 'range',
        tableRender: {},
        codeVisible: false,
        infoDrawerVisible: false,
        diffDrawerVisible: false,
        mergeColumnVisible: false,
        deleteNestedVisible: false,
        createTableColumnVisible: false,
        createColumnChecked: true,
        mergeColumnOption: {key: '', selection: ''},
        createTableColumnOption: {key: '', selection: ''},
        editTableColumnVisible: false,
        updateTableVisible: false,
        editTableColumnOption: {key: '', selection: '', title: ''},
        tableCellVisible: false,
        tableCellOption: {key: '', selection: ''},
        chartTypeSelect: '',
        columnTypeSelect: '',
        dataSourceTypeSelect: '',
        forceTypeCheck: false,
        forceDataSourceCheck: true,
        dataRenderOption: {
            dataSchemaSelect: false,
            hyperlinkSelect: false,
            commentSelect: false,
            dropdownoptions: {
                pretags: [],
            },
        },
    };
    tableRef = React.createRef<HotTable>();
    saveOptionRef = React.createRef<Input>();
    mergeColumnRef = React.createRef<FormInstance<any>>();
    deleteNestedRef = React.createRef<FormInstance<any>>();
    createColumnRef = React.createRef<FormInstance<any>>();
    editColumnRef = React.createRef<FormInstance<any>>();
    updateRef = React.createRef<FormInstance<any>>();
    cellRef = React.createRef<FormInstance<any>>();

    // create blank array by input preConfig
    initialTableObjectArray = (preConfig: any) => {
        const initialTableObjectArray = [];
        if (preConfig) {
            const { colConfig: {data}} = preConfig;
            const obj = {};
            for (let o of data) {
                obj[o.name] = '';
            }

            // set default row as 5 
            for (let i = 0; i < 5; i++) {
                initialTableObjectArray.push(JSON.parse(JSON.stringify(obj)));
            }
        } 

        return initialTableObjectArray;
    }

    // generate nested header by config
    // each column config has an index to indicate how many levels of merged-parents it has
    setNestedHeaderByColumn = (key: any) => {
        const { config, tableNestedHeader } = table[key];
        let nestedHeader = undefined;
        if (config) {
            let maxLevel = 1;
            for (let i = 0; i < config[0].length; i++) {
                maxLevel = _.max([maxLevel, config[0][i].nestedHeader ? config[0][i].nestedHeader.index : 1]);
            }
            nestedHeader = [];
            for (let i = 0; i < maxLevel; i++) nestedHeader.push([]);
            // construct the nested header array
            config[0].forEach((o: any) => {
                if (!o?.nestedHeader) {
                    for (let j = 0; j < maxLevel; j++) {
                        nestedHeader[j].push(j === maxLevel - 1 ? o.title : {});
                    }
                } else {
                    const { array } = o?.nestedHeader;
                    for (let k = 0; k < maxLevel; k++) {
                        const currentCol = array[array.length - 1 - k];
                        if (nestedHeader[k].length > 0) {
                            const { label, colspan } = nestedHeader[k][nestedHeader[k].length - 1];
                            if (label && colspan && label === currentCol) {
                                nestedHeader[k][nestedHeader[k].length - 1].colspan = colspan + 1;
                                continue;
                            }
                        }
                        nestedHeader[k].push(currentCol === '' ? {} : {label: currentCol, colspan: 1});
                    }
                }
            })
        }
        tableNestedHeader[0] = nestedHeader;
        this.saveChanges(key);
    }

    // config.nestedHeader.index: highest level parent this column has, .parent: [] collect parents bottom to top
    setNestedConfig = (key: any, options: any, type: any) => {
        const { config } = table[key];
        if (type === 'addHeader') {
            let maxLevel = 1;
            let globalMaxLevel = 1;
            const { mergeParent } = options['values'];
            // find the max level of selected column, in order to set/create nestedHeader config
            for (let i = options.start; i <= options.end; i++) {
                maxLevel = _.max([maxLevel, config[0][i].nestedHeader ? config[0][i].nestedHeader.index : 1]);
                if (!config[0][i].nestedHeader) config[0][i]['nestedHeader'] = {index: 1, array: [config[0][i].title]};
            }
            // config the new input nested header to the selected columns
            for (let i = options.start; i <= options.end; i++) {
                if (config[0][i]['nestedHeader'].index === maxLevel) {
                    config[0][i]['nestedHeader'].array.push(mergeParent);
                } else {
                    for (let j = config[0][i]['nestedHeader'].index; j <= maxLevel; j++) {
                        config[0][i]['nestedHeader'].array.push(j === maxLevel ? mergeParent : '');
                    }
                }
                config[0][i]['nestedHeader'].index = maxLevel + 1;
            }
            // find the global max level of columns
            for (let i = 0; i < config[0].length; i++) {
                globalMaxLevel = _.max([globalMaxLevel, config[0][i].nestedHeader ? config[0][i].nestedHeader.index : 1]);
            }
            // add blank header to non-selected column header
            for (let i = 0; i < config[0].length; i++) {
                for (let k = config[0][i]['nestedHeader']?.index; k < globalMaxLevel; k++) {
                    config[0][i]['nestedHeader'].array.push('');
                }
            }
        } else if (type === 'addColumn') {
           const { originHeader, addID, start } = options;
           if (JSON.stringify(originHeader) !== '{}') {
            originHeader.array[0] = addID;
            config[0][start]['nestedHeader'] = originHeader;
           }
        }
        this.setNestedHeaderByColumn(key);
    }

    // update cell by column
    setCellbyColumn = (key: any) => {
        const { config, cell } = table[key];
        cell[0] = [];
        for (let i = 0; i < config[0].length; i++) {
            if (config[0][i]['cellOption']) {
                config[0][i]['cellOption'].forEach((a: any) => {
                    cell[0].push({...a, col: i, row: a.cellRow})
                })
            }
        }
    }

    // manage table history data with redo/undo
    manageTableHistory = (operation: any, key: any) => {
        if (tableHistory[key] && isNumber(historyIndex[key])) {
            if (operation === 'undo' && historyIndex[key] > 0) historyIndex[key] = historyIndex[key] - 1;
            if (operation === 'redo' && historyIndex[key] < tableHistory[key].length - 1) historyIndex[key] = historyIndex[key] + 1;
            const tempTable = tableHistory[key][historyIndex[key]];
            if (tempTable.config && JSON.stringify(table[key].config) !== JSON.stringify(tempTable.config)) {
                tempTable.config[0].forEach((o: any) => {
                    if ((o?.renderer === `${o.title}.renderType`) && o.options) this.createRenderType(o.options);
                })
            }
            table[key] = JSON.parse(JSON.stringify(tempTable));
            const saveTableID = JSON.parse(JSON.stringify(this.state.saveTable));
            saveTableID[key] = true;
            this.setState({ tableRender: table, saveTable: saveTableID });
        }
    }

    // compare whether needs to push in the history stack after every operation
    compareTableHistory = (key: any) => {
        if (tableHistory[key] && isNumber(historyIndex[key])) {
            if (JSON.stringify(table[key]) !== JSON.stringify(tableHistory[key][historyIndex[key]])) {
                tableHistory[key] = tableHistory[key].slice(0, historyIndex[key] + 1);
                tableHistory[key].push(JSON.parse(JSON.stringify(table[key])));
                historyIndex[key] += 1;
            }
        }
    }

    // save changes for each edit
    saveChanges = (key: any) => {
        const saveTableID = JSON.parse(JSON.stringify(this.state.saveTable));
        saveTableID[key] = true;
        this.genWidthArray(true, true, key);
        this.compareTableHistory(key);
        this.setState({tableRender: table, saveTable: saveTableID});
    }

    // save table object's change when edit
    saveEditChange = (key: any, obj: any) => {
        const { config, data, tableNestedHeader } = table[key];
        const { source } = obj;
        if (source && source !== 'loadData') {
            // (?) the tabledata[0] will be changed automatically when edit the cell text

            // move the column
            if (source === 'createRow' || source === 'removeRow') {
                const { moveOption } = obj;
                data[0].forEach((a: any) => {
                    const keys = Object.keys(a);
                    for (let key of keys) {
                        if (a[key] === null) a[key] = '';
                    }
                });
                config[0].forEach((o: any) => {
                    if (o?.cellOption) {
                        for (let q of o?.cellOption) {
                            if (q.cellRow >= moveOption?.index) q.cellRow = source === 'createRow' ? q.cellRow + 1 : q.cellRow - 1;
                        }
                    }
                })
            }

            if (source === 'moveColumn') {
                // get the re-order data/header array
                // const tempData = this.tableRef.current.hotInstance.getData();
                const tempHeader = this.tableRef.current.hotInstance.getColHeader();
                let move = true;

                // help function to get the object key by value
                const getObject = (object: any, target: any) => {
                    for (let a of object) {
                        const {data} = a;
                        if (data === target) return a;
                    }
                    return {};
                }

                // if there is nested header, we limit the movement under the same parent header
                if (tableNestedHeader[0] && tableNestedHeader[0].length > 1) {
                    let diff = {one: '', two: ''};
                    for (let i = 0; i < tempHeader.length; i++) {
                        if (tempHeader[i] !== config[0][i].title) {
                            if (diff.one === '') diff.one = config[0][i].title;
                            else diff.two = config[0][i].title;
                        }
                    }
                    if (diff.one !== '' && diff.two !== '') {
                        let diffObj1 = getObject(config[0], diff.one);
                        let diffObj2 = getObject(config[0], diff.two);
                        if (diffObj1?.nestedHeader && diffObj2?.nestedHeader) {
                            let array1 = diffObj1?.nestedHeader.array;
                            let array2 = diffObj2?.nestedHeader.array;
                            for (let i = 1; i < array1.length; i++) {
                                if (array1[i] !== array2[i]) move = false; break;
                            }
                        } else move = false;
                    }
                }

                // re-order the header object
                if (move) {
                    const saveTableConfig = [];
                    const saveTableColumn = JSON.parse(JSON.stringify(config[0]));
                    tempHeader.forEach((a: any) => {
                        saveTableConfig.push(getObject(saveTableColumn, a));
                    })
                    config[0] = saveTableConfig;
                    this.setNestedHeaderByColumn(key);
                } else {
                    message.error('Can not move columns under different nested header!')
                }
            }
            
            this.setCellbyColumn(key);
            this.saveChanges(key);
        }
    }

    saveRowChange = (movedRows: any, finalIndex: any, dropIndex: any, uuid: any) => {
        const { data, cell } = table[uuid];
        
        const tempData = {};
        const shift = finalIndex - movedRows[0]; 
        const start = shift > 0 ? movedRows[0] : dropIndex;
        const end = shift > 0 ? dropIndex : movedRows[movedRows.length - 1] + 1;
        // adjust the data row
        for (let key of Object.keys(data[0])) {
            let k = toNumber(key);
            if (k < start || k >= end) tempData[key] = data[0][key];
            else {
                if (movedRows.indexOf(k) !== -1) tempData[k + shift] = data[0][key];
                else tempData[shift > 0 ? k - movedRows.length : k + movedRows.length] = data[0][key]; 
            }
        }
        // adjust the cell row
        for (let c of cell[0]) {
            if (c.row < start || c.row >= end) continue;
            else if (movedRows.indexOf(c.row) !== -1) c.row = c.row + shift;
            else c.row = shift > 0 ? c.row - movedRows.length : c.row + movedRows.length;
        }
        const moveRow = [];
        for (let key of Object.keys(tempData)) moveRow.push(tempData[key]);
        data[0] = moveRow;

        this.saveChanges(uuid);
    }

    genWidthArray = (col: boolean, row: boolean, uuid: any) => {
        const { tableSize, config, data } = table[uuid];
        if (col) {
            const tempColWidth = [];
            config[0].forEach((o: any) => {
                tempColWidth.push(o?.colWidth ? o?.colWidth : 150);
            })
            tableSize.colWidths = tempColWidth;
        }; 
        if (row) {
            const tempRowHeight = [];
            const rowHeight = config[0][0]['rowHeight'];
            const length = data[0].length;
            for (let i = 0; i < length; i++) {
                tempRowHeight.push(rowHeight && rowHeight.hasOwnProperty(i) ? rowHeight[i] : 25);
            }
            tableSize.rowHeights = tempRowHeight;
        }
    }

    afterReSize = (newSize: any, column: any, uuid: any, type: any) => {
        const { config } = table[uuid];
        const tempCol = JSON.parse(JSON.stringify(config[0]));
        if (type === 'col') {
            tempCol[column]['colWidth'] = newSize;
        }
        else if (type === 'row') {
            tempCol.forEach((o: any) => {
                if (!o['rowHeight']) o['rowHeight'] = {};
                o['rowHeight'][`${column}`] = newSize;
            })
        }
        config[0] = tempCol;
        this.saveChanges(uuid);
    }

    // save edit changes to the backend
    saveTableData = (key: any, canvasID: any, commit: string, parentThis: any) => {
        // const createdBy = localStorage.getItem('kaleido_username');
        const createdBy = 'jkl';
        const { data, config, cell, tableNestedHeader } = table[key];

        for (let o of config[0]) {
            if (o?.forceTypeCheck) {
                for (let a of data[0]) {
                    if (o.source.indexOf(a[o.title]) === -1) {
                        message.error(` The column ${o.title} must meet the dropdown requires !`);
                        return;
                    }
                }
            }
            if (o?.forceDataSourceCheck) {
                if (o.dataType === 'integer') {
                    for (let a of data[0]) {
                        if ((!isInteger(Number(a[o.title])))) {
                            message.error(` The column ${o.title} must be integer!`);
                            return;
                        }
                    }
                } else if (o.dataType === 'float') {
                    function isFloat(n: any) { return parseInt(n) !== n; } 
                    for (let a of data[0]) {
                        if ((!isFloat(Number(a[o.title])))) {
                            message.error(` The column ${o.title} must be float!`);
                            return;
                        }
                    }
                }
            }
        }
        const dataChart = getItemByID(key, parentThis.state.localData);
        dataChart.uiJSON.data = data[0];
        dataChart.uiJSON.cell = cell[0];
        dataChart.uiJSON.columnConfig = config[0];
        dataChart.uiJSON.tableNestedHeader = tableNestedHeader[0];
        dataChart.uiJSON.commit = commit === undefined ? "no comment" : commit;
        setItemByID(key, dataChart);
        const saveTableID = JSON.parse(JSON.stringify(this.state.saveTable));
        saveTableID[key] = false;
        message.success('Save Success');
        setTimeout(() => window.location.reload(), 1000);
        this.setState({saveTable: saveTableID});
        // const {dispatch} = parentThis.props;
        // if (dispatch) {
        //     const dataChart = { application: {uiJSON: {chartType: 'table', data: data[0], cell: cell[0], commit, columnConfig: config[0] }}, type: 'chart', createdBy, parent:{ uuid: canvasID, type: 'canvas'}, updateObjID: key };
        //     dispatch({
        //         type: 'mstage/updateObject',
        //         payload: dataChart,
        //     }).then(() => {
        //         // parentThis.props.fetchNewSpaceInfo();
        //         message.success('Save Success');
        //         const saveTableID = JSON.parse(JSON.stringify(this.state.saveTable));
        //         saveTableID[key] = false;
        //         this.setState({saveTable: saveTableID});
        //     });
        // }
    }

    createRenderType = (options: any) => {
        const {colorSchema, hyperlink, type, ID, schemaType} = options;
        let renderType = null;
        if (type === 'link') {
            Handsontable.cellTypes.registerCellType('link', {
                editor: Handsontable.editors.TextEditor,
            });
        }
        if (!colorSchema && !hyperlink) {
            if (type === 'link') {
                Handsontable.renderers.registerRenderer(`${ID}.renderType`, function(hotInstance, TD, row, column, prop, value, cellProperties) {
                    if (value && value.indexOf('http://') !== -1 || value.indexOf('https://') !== -1) TD.innerHTML = `<a href=${value} target="_blank">${value}</a>`;
                });
                renderType = `${ID}.renderType`;
            } else renderType = type;
        } else {
            Handsontable.renderers.registerRenderer(`${ID}.renderType`, function(hotInstance, TD, row, column, prop, value, cellProperties) {
                Handsontable.renderers.TextRenderer.apply(this, arguments);
                if (colorSchema) {
                    if (schemaType === 'range' || schemaType === undefined) { 
                        if (isNumber(parseInt(value)) && value !== '') {
                            colorSchema.forEach((o: any) => {
                                if (parseFloat(value) >= parseFloat(o.start) && parseFloat(value) < parseFloat(o.end)) {
                                    TD.style.color = o.text;
                                    TD.style.backgroundColor = o.color;
                                }
                            })
                        }
                    } else if (schemaType === 'string') {
                        colorSchema.forEach((o: any) => {
                            if (value === o.strMatch) {
                                TD.style.color = o.text;
                                TD.style.backgroundColor = o.color;
                            }
                        })
                    }
                    TD.innerHTML = value;
                }
                if(hyperlink) {
                    if (type === 'dropdown') TD.innerHTML = `<div class="htAutocomplete"><a href=${hyperlink.replace('{}', value)} target="_blank">${value}</a><div class="htAutocompleteArrow">▼</div></div>`;
                    else if (type === 'link' && value.indexOf('http://') !== -1 || value.indexOf('https://') !== -1) TD.innerHTML = `<a href=${value} target="_blank">${value}</a>`;
                    else TD.innerHTML = `<a href=${hyperlink.replace('{}', value)} target="_blank">${value}</a>`;
                }
                else if (type === 'dropdown') TD.innerHTML = `<div class="htAutocomplete">${value}<div class="htAutocompleteArrow">▼</div></div>`;
                else if (type === 'link') TD.innerHTML = `<a href=${value} target="_blank">${value}</a>`;
            });
            renderType = `${ID}.renderType`;
        }
        return renderType;
    } 

    createColumn = (key: any, selection: any, values: any) => {
        const { col } = selection[0].start;
        const { index, addID, addType, dropdown, colorSchema, hyperlink, dataSourceType, schemaType, addHeaderColor } = values;
        const { data, config } = table[key];
        let error = false;

        config[0].forEach((o: any) => {
            if (o.title === addID) {
                message.error(` The column name ${addID} has already exist !`);
                error = true;
            }
        })

        if (error) return;

        let tempData = JSON.parse(JSON.stringify(data[0]));
        let tempColumn = JSON.parse(JSON.stringify(config[0]));
        let originHeader = tempColumn[col]?.nestedHeader ? JSON.parse(JSON.stringify(tempColumn[col]?.nestedHeader)) : {};
        let addIndex = index === 'left' ? col : col + 1;

        tempData.forEach((a: any, i: any) => {
            const keys = Object.keys(a);
            keys.splice(addIndex, 0, addID);
            const newData = {};
            keys.forEach((a: any) => {
                newData[a] = '';
            })
            tempData[i] = Object.assign(newData, a);
        });

        let renderTpye = '';
        let options = {addType, ID: addID, schemaType};
        if (colorSchema) options['colorSchema'] = colorSchema;
        if (addHeaderColor) options['headerColor'] = addHeaderColor;
        if (hyperlink) options['hyperlink'] = hyperlink;
        renderTpye = this.createRenderType(options);

        tempColumn.splice(addIndex, 0, {data: addID, title: addID, type: addType, dataType: dataSourceType, renderer: renderTpye, source: addType === 'dropdown' ? dropdown : null, forceTypeCheck: this.state.forceTypeCheck, forceDataSourceCheck: this.state.forceDataSourceCheck, options});
        tempColumn = tempColumn.map((o: any) => {
            return _.pickBy(o, value => value !== null);
        })

        data[0] = tempData;
        config[0] = tempColumn;
        this.setCellbyColumn(key);
        this.setNestedConfig(key, {start: addIndex, addID, originHeader }, 'addColumn');
        this.saveChanges(key);
    }

    editColumn = (key: any, selection: any, values: any) => {
        const { col } = selection[0].start;
        const { editID, editType, dropdown, colorSchema, hyperlink, dataType, schemaType, editHeaderColor } = values;
        const { data, config } = table[key];
        const tempColumn = JSON.parse(JSON.stringify(config[0]));
        let error = false;

        config[0].forEach((o: any) => {
            if (editID && o.title === editID && o.title !== config[0][col].data) {
                message.error(` The column name ${editID} has already exist !`);
                error = true;
            }
        })

        if (error) return false;
        
        if (editID) {
            let originTitle = tempColumn[col].title;
            tempColumn[col].title = editID;
            tempColumn[col].data = editID;
            let newData = [];
            data[0].forEach((a: any) => {
                let curData = {};
                for (let b in a) {
                    if (b === originTitle) {
                        curData[editID] = a[b];
                    } else {
                        curData[b] = a[b]; 
                    }
                }
                newData.push(curData);
            });
            data[0] = newData;
        }

        if (editType) {
            tempColumn[col].forceTypeCheck = this.state.forceTypeCheck;
            tempColumn[col].forceDataSourceCheck = this.state.forceDataSourceCheck;
            let options = {type: editType, ID: editID || tempColumn[col].title, schemaType};
            if (colorSchema) options['colorSchema'] = colorSchema;
            if (editHeaderColor) options['headerColor'] = editHeaderColor;
            if (hyperlink) options['hyperlink'] = hyperlink;
            tempColumn[col].renderer = this.createRenderType(options);
            tempColumn[col].type = editType;
            tempColumn[col].dataType = dataType;
            tempColumn[col].source = editType === 'dropdown' ? dropdown : null;
            tempColumn[col].options = options;
        }
        config[0] = tempColumn.map((o: any) => {
            return _.pickBy(o, value => value !== null);
        });
        this.saveChanges(key);
        return true;
    }

    removeColumn = (key: any, selection: any) => {
        const { col } = selection[0].start;
        const { data, config } = table[key];
        const tempData = JSON.parse(JSON.stringify(data[0]));
        const tempColumn = JSON.parse(JSON.stringify(config[0]));
        
        let deleteKey = tempColumn[col].title;
        tempColumn.splice(col, 1);
        tempData.forEach((a: any) => {
            delete a[deleteKey];
        });
        
        data[0] = tempData;
        config[0] = tempColumn;
        this.setCellbyColumn(key);
        this.saveChanges(key);
    }

    findColumnCell = (obj: any, cellRow: any) => {
        let res = null;
        obj.forEach((o: any) => {
            if (o.cellRow === cellRow) res = o;
        })
        return res;
    }

    editCell = (key: any, selection: any, values: any) => {
        const {cellComment, cellType, colorSchema, hyperlink, dropdown, dataSourceType, schemaType} = values;
        const { config } = table[key];
        if (values) {
            const { col, row } = selection[0].start;
            let find = false;
            let options = {type: cellType, ID: `${config[0][col].title}+${row}`, schemaType};
            if (colorSchema) options['colorSchema'] = colorSchema;
            if (hyperlink) options['hyperlink'] = hyperlink;
            if (!config[0][col]['cellOption']) config[0][col]['cellOption'] = [];
            let a = this.findColumnCell(config[0][col]['cellOption'], row);
            if (a) {
                a.comment = cellComment ? {value: cellComment, readOnly: true} : null;
                a.renderer = this.createRenderType(options);
                a.type = cellType;
                a.source = cellType === 'dropdown' ? dropdown : null;
                a.options = options;
                a.dataType = dataSourceType;
                find = true;
            }

            if (!find) config[0][col]['cellOption'].push({cellRow: row, comment: cellComment ? {value: cellComment, readOnly: true} : null, renderer: this.createRenderType(options), type: cellType, source: cellType === 'dropdown' ? dropdown : null, options, dataType: dataSourceType});
            
            config[0][col]['cellOption'] = config[0][col]['cellOption'].map((o: any) => {
                return _.pickBy(o, value => value !== null);
            });
            
            this.setCellbyColumn(key);
            this.saveChanges(key);
        }
    }

    // initial table data and configs, interface of the whole component
    getTableData(uuid: any, canvasID: any, parentThis: any, preConfig: any) {
        if (!table[uuid]) table[uuid] = { data: {}, config: {}, cell: {}, hasSaved: {}, info: {}, tableSize: { colWidths: [], rowHeights: []}, tableNestedHeader: {} };
        if (!table[uuid]?.hasSaved[0] || parentThis.state.updateChart) {
            const { data, config, hasSaved, cell, info, tableSize, tableNestedHeader } = table[uuid];
            const obj = getItemByID(uuid, parentThis.state.localData);
            data[0] = obj?.uiJSON.data;
            cell[0] = obj?.uiJSON.cell;
            config[0] = obj?.uiJSON.columnConfig;
            tableNestedHeader[0] = obj?.uiJSON.tableNestedHeader;
            info[0] = { title: obj?.uiJSON?.title };
            if (!data[0]) {
                data[0] = this.initialTableObjectArray(preConfig);
            }
            if (!cell[0]) {
                cell[0] = [];
            }
            if (!config[0]) {
                config[0] = [];
                const getObject = (object: any, target: any) => {
                    for (let a of object) {
                        if (a.name === target) return a;
                    }
                    return {};
                }
                Object.keys(data[0][0]).forEach((a: any) => {
                    const obj = getObject(preConfig?.colConfig.data, a);
                    config[0].push({data: a, title: a, type: 'text', dataType: obj.dataType, source: null, forceDataSourceCheck: true});
                })
            }
            if (!tableSize || tableSize.colWidths.length === 0 || tableSize.rowHeights.length === 0) this.genWidthArray(true, true, uuid);
            config[0].forEach((o: any) => {
                if (o?.renderer === `${o.title}.renderType` && o.options) this.createRenderType(o.options);
            })
            cell[0].forEach((o: any) => {
                if (o?.renderer === `${o?.options?.ID}.renderType` && o.options) this.createRenderType(o.options);
            })
            hasSaved[0] = true;
            originTable = JSON.parse(JSON.stringify(table));
            tableHistory[uuid] = [];
            tableHistory[uuid].push(JSON.parse(JSON.stringify(table[uuid] || '')));
            historyIndex[uuid] = 0;
            // this.setNestedHeaderByColumn(uuid);
            this.setState({tableRender: table});
            parentThis.setState({ updateChart: false });
        }

        const hotSettings = {
            data: this.state.tableRender[uuid]?.data[0],
            cell: this.state.tableRender[uuid]?.cell[0],
            id: uuid,
            comments: true,
            manualColumnResize: true,
            manualRowResize: true,
            manualColumnMove: true,
            manualRowMove: true,
            colHeaders: true,
            rowHeaders: true,
            // nestedHeaders: [
            //     [{label: 'N', colSpan: 3}, {}, {}],
            //     [{label: 'F', colSpan: 2}, {}, {label: 'I', colspan: 2}],
            //     ['A', 'B', 'C', 'D', 'E'],
            // ] as any,
            nestedHeaders: this.state.tableRender[uuid]?.tableNestedHeader[0],
            filters: true,
            dropdownMenu: [
                'make_read_only',
                'clear_column',
                'alignment',
                '---------',
                'filter_by_condition',
                'filter_by_value',
                'filter_action_bar',
            ] as Handsontable.contextMenu.PredefinedMenuItemKey[],
            height: 'auto',
            colWidths: this.state.tableRender[uuid]?.tableSize.colWidths.length > 0 ? this.state.tableRender[uuid]?.tableSize.colWidths : 150,
            rowHeights: this.state.tableRender[uuid]?.tableSize.rowHeights.length > 0 ? this.state.tableRender[uuid]?.tableSize.rowHeights : 20,
            licenseKey: "non-commercial-and-evaluation",
            contextMenu: {
                items: {
                    'row_above': {},
                    'row_below': {},
                    'remove_row': {},
                    'clear_filter': {
                        name: 'Clear filter',
                        disabled: function() {return this.getSelectedLast()[1] === -1 || this.getSelectedLast()[0] !== -1},
                        callback: () => {
                            const filtersPlugin = this.tableRef.current.hotInstance.getPlugin('filters');
                            filtersPlugin.clearConditions();
                            filtersPlugin.filter();
                            this.tableRef.current.hotInstance.render();
                        }
                    },
                    'merge columns': {
                        name: 'Merge columns',
                        callback: (key: any, selection: any) => {
                            this.mergeColumnRef.current?.resetFields();
                            this.setState({ 
                                mergeColumnVisible: true,
                                mergeColumnOption: {key: uuid, selection}
                            })
                        }
                    },
                    'delete nestedHeader': {
                        name: 'Delete nasted header',
                        disabled: function() {return !table[uuid]?.tableNestedHeader[0] || table[uuid]?.tableNestedHeader[0]?.length === 1},
                        callback: (key: any, selection: any) => {
                            this.deleteNestedRef.current?.resetFields();
                            this.setState({ 
                                deleteNestedVisible: true,
                                mergeColumnOption: {key: uuid, selection}
                            })
                        }
                    },
                    '---------': {},
                    'add_col': {
                        name: 'Insert column',
                        disabled: function() {return this.getSelectedLast()[1] === -1},
                        callback: (key: any, selection: any) => {
                            const { col } = selection[0].start; 
                            this.createColumnRef?.current?.resetFields();
                            this.setState({ 
                                selectColumnTitle: col, 
                                createTableColumnVisible: true, 
                                createTableColumnOption: {key: uuid, selection},
                                dataRenderOption: {hyperlinkSelect: false, dataSchemaSelect: false, commentSelect: false },
                                forceTypeCheck: false,
                                forceDataSourceCheck: true,
                            });
                        },
                    },
                    'edit_col': {
                        name: 'Edit column',
                        disabled: function() {return this.getSelectedLast()[1] === -1},
                        callback: (key: any, selection: any) => {
                            const { col } = selection[0].start; 
                            const { options, source, forceTypeCheck, forceDataSourceCheck, title, type, dataType } = table[uuid]?.config[0][col] || {};
                            this.setState({ 
                                editTableColumnVisible: true, 
                                editTableColumnOption: {key: uuid, selection, title},
                                columnTypeSelect: type || '',
                                dataSourceTypeSelect: dataType || '',
                                dataRenderOption: {hyperlinkSelect: options?.hyperlink ? true : false, dataSchemaSelect: options?.colorSchema ? true : false, commentSelect: false, dropdownoptions: { pretags: source } },
                                dataSchemaSelect: options?.colorSchema ? true : false,
                                forceTypeCheck: forceTypeCheck ? true : false,
                                forceDataSourceCheck: forceDataSourceCheck ? true : false,
                                schemaType: options?.schemaType ? options?.schemaType : 'range',
                            });
                            this.editColumnRef?.current?.resetFields();
                            this.editColumnRef?.current?.setFieldsValue({ 
                                editID: title,
                                editType: type,
                                editHeaderColor: options?.headerColor,
                                hyperlink: options?.hyperlink,
                                colorSchema: options?.colorSchema,
                            });
                        },
                    },
                    'rem_col': {
                        name: 'Remove column',
                        disabled: function() {return this.getSelectedLast()[1] === -1},
                        callback: (key: any, selection: any) => {this.removeColumn(uuid, selection)},
                    },
                    'edt_cell': {
                        name: 'Edit cell',
                        disabled: function() {return this.getSelectedLast()[1] === -1 || this.getSelectedLast()[0] === -1},
                        callback: (key: any, selection: any) => {
                            const { col, row } = selection[0].start;
                            const filtertCell = _.pickBy(table[uuid]?.cell[0], value => value.col === col && value.row === row);
                            const editCell = filtertCell[Object.keys(filtertCell)[0]];
                            this.setState({ 
                                tableCellVisible: true, 
                                tableCellOption: {key: uuid, selection},
                                columnTypeSelect: editCell?.type || '',
                                dataSourceTypeSelect: editCell?.dataType || '',
                                dataRenderOption: {hyperlinkSelect: editCell?.options?.hyperlink ? true : false, dataSchemaSelect: editCell?.options?.colorSchema ? true : false, commentSelect: editCell?.comment?.value ? true : false, dropdownoptions: { pretags: editCell?.source } },
                                dataSchemaSelect: editCell?.options?.colorSchema ? true : false, 
                                schemaType: editCell?.options?.schemaType ? editCell?.options?.schemaType : 'range',
                            });
                            this.cellRef?.current?.resetFields();
                            this.cellRef?.current?.setFieldsValue({
                                cellType: editCell?.type,
                                dropdown: editCell?.source?.toString(),
                                cellComment: editCell?.comment?.value,
                                hyperlink: editCell?.options?.hyperlink,
                                colorSchema: editCell?.options?.colorSchema,
                            });
                        },
                    }
                }
            }
        }

        const saveOption = (
            <div style={{display: 'flex'}}>
                <Input ref={this.saveOptionRef} placeholder={"Input Your Save Commit"} />
                <Button onClick={() => {
                    this.saveTableData(uuid, canvasID, this.saveOptionRef.current.state.value, parentThis)
                }}>Save</Button>
            </div>
        );

        const hotTable = 
            <div id='hot-app'>
                <Row gutter={24}>
                    <Col span={12} style={{marginBottom: '8px'}}>
                        <div className="table-toolbox" style={{ display: "flex" }}>
                            <InfoCircleOutlined style={{ fontSize: '22px' }} onClick={() => {this.setState({infoDrawerVisible: true})}}/> 
                            <Popover content={'Show changes of table data'}>
                                <ControlOutlined style={{ marginLeft: '6px', fontSize: '22px' }} onClick={() => {this.setState({ diffDrawerVisible: true })}}/>
                            </Popover>
                            <Popover content={"Undo Edit"}>
                                <UndoOutlined style={{ marginLeft: '6px', fontSize: '22px', color: isNumber(historyIndex[uuid]) && historyIndex[uuid] > 0 ? 'black' : '#D8D8D8'}} onClick={() => {this.manageTableHistory('undo', uuid)}}/>
                            </Popover>
                            <Popover content={"Redo Edit"}>
                                <RedoOutlined style={{ marginLeft: '6px', fontSize: '22px',  color: isNumber(historyIndex[uuid]) && tableHistory[uuid] && (historyIndex[uuid] < tableHistory[uuid].length - 1) ? 'black' : '#D8D8D8'}} onClick={() => {this.manageTableHistory('redo', uuid)}}/>
                            </Popover>
                        </div>
                    </Col>
                    <Col span={12} style={{marginBottom: '8px'}}>
                        <Button style={{float: 'right', marginLeft: '8px'}} onClick={() => this.exportTableData(uuid)}>Download</Button>
                        <Button style={{float: 'right', marginLeft: '8px'}} onClick={() => {this.setState({ codeVisible: true })}}>Code</Button>
                        <Popover content={saveOption} title="Save Table Data" trigger="click">
                            <Button type={this.state.saveTable[uuid] ? "primary" : 'default'} style={{float: 'right'}}>Save Table</Button>
                        </Popover>
                    </Col>
                    <Col span={24}>
                        <HotTable 
                            style={{
                                width: '100%',
                                overflow: 'hidden',
                            }}
                            settings={hotSettings}
                            columns={this.state.tableRender[uuid]?.config[0]}
                            ref={this.tableRef}
                            stretchH={'all'}
                            afterChange={(source) => {this.saveEditChange(uuid, {source})}}
                            afterCreateRow={(index, amount, s) => {this.saveEditChange(uuid, {source: 'createRow', moveOption: {index, amount, s}})}}
                            afterRemoveRow={(index) => {this.saveEditChange(uuid, {source: 'removeRow', moveOption: {index}})}}
                            afterRowMove={(movedRows, finalIndex, dropIndex) => {this.saveRowChange(movedRows, finalIndex, dropIndex, uuid)}}
                            afterColumnMove={() => {this.saveEditChange(uuid, {source: 'moveColumn'})}}
                            afterColumnResize={(newSize, column) => {this.afterReSize(newSize, column, uuid, 'col')}}
                            afterRowResize={(newSize, column) => {this.afterReSize(newSize, column, uuid, 'row')}}
                        />
                    </Col>
                </Row>
            </div>
        ;
        return hotTable;
    }

    onColumnTypeChange = (value: any) => {
        this.setState({ columnTypeSelect: value });
    }

    onDataSourceTypeChange = (value: any) => {
        this.setState({ dataSourceTypeSelect: value });
    }

    onColumnMergeFinish = async (key: any, selection: any, type: any) => {
        let values = '';
        if (type === 'merge') values = await this.mergeColumnRef.current.validateFields();
        if (type === 'delete') values = await this.deleteNestedRef.current.validateFields();
        this.setState({ mergeColumnVisible: false, deleteNestedVisible: false });

        if (values) {
            let start = selection[0].start.col;
            let end = selection[0].end.col;
            if (type === 'merge') this.setNestedConfig(key, {values, start, end}, 'addHeader');
            if (type === 'delete') this.setNestedConfig(key, {values, start, end}, 'deleteHeader');
        }
    }

    onColumnCreateFinish = async (key: any, selection: any) => {
        let values = await this.createColumnRef.current.validateFields();
        this.setState({ createTableColumnVisible: false })
        if (values) {
            if (values.addType === 'dropdown') {
                const {pretags} = this.state.dataRenderOption?.dropdownoptions;
                if (pretags.length === 0) {
                  message.error('You at least need one dropdown index! ');
                  return;
                }
                values['dropdown'] = pretags;
            }
            if (values.colorSchema && values.colorSchema.length > 0) values['schemaType'] = this.state.schemaType;
            this.createColumn(key, selection, values);
            this.createColumnRef.current.resetFields();
        }
    }
    
    onColumnEditFinish = async (key: any, selection: any) => {
        const values = await this.editColumnRef.current.validateFields();
        if (values) {
          if (values.editType === 'dropdown') {
            const {pretags} = this.state.dataRenderOption?.dropdownoptions;
            if (pretags.length === 0) {
              message.error('You at least need one dropdown index! ');
              return;
            }
            values['dropdown'] = pretags;
          }
          if (values.colorSchema && values.colorSchema.length > 0) values['schemaType'] = this.state.schemaType;
          if (this.editColumn(key, selection, values)) {
            this.editColumnRef.current.resetFields();
            this.setState({ editTableColumnVisible: false });
          } else this.editColumnRef.current.setFieldsValue(values);
        }
    }
    
    onCellEditFinish = async (key: any, selection: any) => {
        const saveTableID = JSON.parse(JSON.stringify(this.state.saveTable));
        saveTableID[key] = true;
        const values = await this.cellRef.current.validateFields();
        if (values) {
            if (values.cellType === 'dropdown') {
                const {pretags} = this.state.dataRenderOption?.dropdownoptions;
                if (pretags.length === 0) {
                    message.error('You at least need one dropdown index! ');
                    return;
                }
                values['dropdown'] = pretags;
            }
            if (values.colorSchema && values.colorSchema.length > 0) values['schemaType'] = this.state.schemaType;
            this.editCell(key, selection, values)
        }
        this.setState({ tableRender: table, tableCellVisible: false, saveTable: saveTableID })
    }

    onCellCleanFinish = async (key: any, selection: any) => {
        const saveTableID = JSON.parse(JSON.stringify(this.state.saveTable));
        saveTableID[key] = true;
        const { col, row } = selection[0].start;
        const { cell } = table[key];
        cell[0] = [_.pickBy(cell[0], value => value.row !== row && value.col !== col)];
        if (JSON.stringify(cell[0]) === '[{}]') cell[0] = [];
        this.setState({ tableRender: table, tableCellVisible: false, saveTable: saveTableID })
    }

    exportTableData = (key: any) => {
        const exportPlugin = this.tableRef.current.hotInstance.getPlugin('exportFile');
        const {info} = table[key];
        exportPlugin.downloadFile('csv', {
            bom: false,
            columnDelimiter: ',',
            columnHeaders: true,
            exportHiddenColumns: true,
            exportHiddenRows: true,
            fileExtension: 'csv',
            filename: `Table_${info[0]?.title}_[YYYY]-[MM]-[DD]`,
            mimeType: 'text/csv',
            rowDelimiter: '\r\n',
            rowHeaders: true
        })
    }

    updateTableData = (key: any) => {
        const { data, config } = table[key];
        const saveTableID = JSON.parse(JSON.stringify(this.state.saveTable));
        data[0] = eval(file[key][0]);
        config[0] = [];
        Object.keys(data[0][0]).forEach((a: any) => {
            config[0].push({data: a, title: a, type: 'text'});
        })
        saveTableID[key] = true;
        this.setCellbyColumn(key);
        this.setState({tableRender: table, saveTable: saveTableID})
    }

    createConfigForm = (type: any) => {
        const {columnTypeSelect, dataRenderOption, forceTypeCheck, forceDataSourceCheck, dataSourceTypeSelect, schemaType} = this.state;
        
        return (
            <>
                {type === 'add' ? 
                    <Form.Item name="index" label="Select Column Position" rules={[{ required: true, message: 'You must select one side to insert' }]}>
                        <Radio.Group>
                            <Radio value='left'>Left</Radio>
                            <Radio value='right'>Right</Radio>
                        </Radio.Group>
                    </Form.Item>
                : ''}
                {type === 'add' || type === 'edit' ? 
                    <>
                        <Form.Item name={`${type}ID`} label="Input Your Column ID" style={{ display: 'inline-block'}} rules={[{ required: true, message: 'You must name your column' }]}>
                            <Input />
                        </Form.Item>
                    </>
                : ''}
                <div style={{display: 'flex', alignItems: 'baseline'}}>
                    <Form.Item name={`${type}Type`} label={`Set ${type} type`} style={{display: 'flex', height: '30px'}}>
                        <Select
                            style={{ width: 200, display: 'flex' }}
                            placeholder={`Select a ${type} type`}
                            value={columnTypeSelect}
                            onChange={this.onColumnTypeChange}
                        >
                            <Select.Option value="text">Text</Select.Option>
                            <Select.Option value="dropdown">Dropdown</Select.Option>
                            <Select.Option value="link">Link</Select.Option>
                        </Select>
                    </Form.Item>
                </div>
                <div style={{display: 'flex', alignItems: 'baseline'}}>
                    <Form.Item name={'dataType'} label={`Set datasource type`} style={{display: 'flex', height: '30px'}}>
                        <Select
                            style={{ width: 200, display: 'flex' }}
                            placeholder={`Select a datasource type`}
                            value={dataSourceTypeSelect}
                            onChange={this.onDataSourceTypeChange}
                        >
                            <Select.Option value="string">String</Select.Option>
                            <Select.Option value="integer">Integer</Select.Option>
                            <Select.Option value="float">Float</Select.Option>
                        </Select>
                    </Form.Item>
                </div>
                {columnTypeSelect != '' ? 
                    <div>
                        <Form.Item label="Select Function">
                            <Checkbox checked={dataRenderOption.dataSchemaSelect} style={{marginLeft: '8px'}} onChange={(e: any) => {this.setState({dataRenderOption: {...this.state.dataRenderOption, dataSchemaSelect: e.target.checked}})}}>Color Schema</Checkbox>
                            <Checkbox checked={dataRenderOption.hyperlinkSelect} style={{marginLeft: '8px'}} onChange={(e: any) => {this.setState({dataRenderOption: {...this.state.dataRenderOption, hyperlinkSelect: e.target.checked}})}}>Hyperlink</Checkbox>
                            <Checkbox defaultChecked={forceDataSourceCheck} style={{marginLeft: '8px'}} onChange={(e: any) => {this.setState({forceDataSourceCheck: e.target.checked})}}>Force DataSoure Type</Checkbox>
                            {type === 'cell' ? 
                                <Checkbox checked={dataRenderOption.commentSelect} style={{marginLeft: '8px'}} onChange={(e: any) => {this.setState({dataRenderOption: {...this.state.dataRenderOption, commentSelect: e.target.checked}})}}>Comment</Checkbox>
                            : ''}
                            {columnTypeSelect != '' && columnTypeSelect === 'dropdown' ? 
                                <Checkbox defaultChecked={forceTypeCheck} style={{marginLeft: '8px'}} onChange={(e: any) => {this.setState({forceTypeCheck: e.target.checked})}}>Force Dropdown Type</Checkbox>
                            : ''}
                        </Form.Item>
                    </div>
                : ''} 
                {columnTypeSelect != '' && columnTypeSelect === 'dropdown' ? 
                    <Form.Item name="dropdown" label="Input Your dropdown array" >
                        <EditableTagGroup parentThis={this} dropdownoptions={dataRenderOption.dropdownoptions} />
                    </Form.Item>
                : ''}
                {columnTypeSelect != '' && dataRenderOption.commentSelect ? 
                  <Form.Item name="cellComment" label="Input Your Comment" >
                    <Input/>
                  </Form.Item>
                : ''}
                {columnTypeSelect != '' && dataRenderOption.hyperlinkSelect ? 
                    <Form.Item name="hyperlink" label="Input Your hyperlink" rules={[{ required: true, message: 'You at least need put one link' }]}>
                        <Input placeholder="Input link like http://xxx/xxx/{}, use {} to include the unique part "/>
                    </Form.Item>
                : ''}
                {columnTypeSelect != '' && dataRenderOption.dataSchemaSelect ? <CreateColorSchema schemaType={schemaType} changeType={(value: any) => {this.setState({ schemaType: value})}}/> : ''}
            </>
        );
    }

    render(): JSX.Element {
        const {
            codeVisible,
            diffDrawerVisible,
            mergeColumnVisible,
            mergeColumnOption,
            deleteNestedVisible,
            createTableColumnVisible,
            createTableColumnOption,
            editTableColumnVisible,
            editTableColumnOption,
            tableCellVisible,
            tableCellOption,
            columnTypeSelect,
            infoDrawerVisible,
        } = this.state;
        const { uuid, canvasID, parentThis, preConfig } = this.props;
        let tableAppendDataExample = [];
        if(parentThis.state.localData) {
            const obj = getItemByID(uuid, parentThis.state.localData);
            const allColConfig = obj?.uiJSON?.columnConfig;
            const ret = {};
            if(allColConfig) {
                allColConfig.map( c => { 
                    ret[c.data] = '';
                })
            }
            tableAppendDataExample = [ret]
        }
        const tableAppendDataString = JSON.stringify(tableAppendDataExample, null, '\t')
        
        return (
            <>
                {this.getTableData(uuid, canvasID, parentThis, preConfig)}
                <Drawer
                    width={440}
                    placement="right"
                    closable={false}
                    onClose={() => {this.setState({infoDrawerVisible: false})}}
                    visible={infoDrawerVisible}
                >
                    <p style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: 24 }}>
                        Chart Info
                    </p>
                    <DescriptionBar item={getItemByID(uuid, parentThis.state.localData)}/>
                </Drawer>
                <Drawer
                    width={740}
                    placement="right"
                    closable={false}
                    onClose={() => {this.setState({ diffDrawerVisible: false })}}
                    visible={diffDrawerVisible}
                >
                    <p style={{ marginBottom: '16px', fontWeight: 'bold' }}>Track Table Change</p>
                    <ReactDiffViewer 
                        styles={{}}
                        oldValue={JSON.stringify(originTable, null, 1)} 
                        newValue={JSON.stringify(this.state.tableRender, null, 1)} 
                        splitView={true}
                        showDiffOnly={true}
                    />
                </Drawer>
                <Drawer
                    width={440}
                    placement="right"
                    closable={false}
                    onClose={() => {this.setState({ codeVisible: false })}}
                    visible={codeVisible}
                >
                    <p className={"tableInfo"} style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: 10 }}>
                        Fetch Data Code
                    </p>
                    <TableCodeView url={`import http.client\nimport ssl\n\nssl._create_default_https_context = ssl._create_unverified_context\nconn = http.client.${ window.location.protocol === 'https:' ? 'HTTPSConnection' : 'HTTPConnection'}("${window.location.hostname}"${window.location.port ? `, "${window.location.port}"` : ''})\npayload = ''\nheaders = {}\nconn.request("GET", "/api/mstage/saved_objects/chart/${uuid}/ui_data?onlydata=true", payload, headers)\nres = conn.getresponse()\ndata = res.read()\nprint(data.decode("utf-8"))`}/>
                    <p className={"tableInfo"} style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: 10, marginTop: 20 }}>
                        Append Data to Table Code
                    </p>
                    <TableCodeView url={`import http.client\nimport json\nimport ssl\n\nssl._create_default_https_context = ssl._create_unverified_context\nconn = http.client.${ window.location.protocol === 'https:' ? 'HTTPSConnection' : 'HTTPConnection'}("${window.location.hostname}"${window.location.port ? `, "${window.location.port}"` : ''})\n#payload data is your append data to this Table\npayload=json.dumps(${tableAppendDataString})\nheaders = {"Content-Type": "application/json"}\nconn.request("PUT", "/api/mstage/saved_objects/chart/${uuid}/ui_data", payload, headers)\nres = conn.getresponse()\ndata = res.read()\nprint(data.decode("utf-8"))`}/>
                </Drawer>
                <Modal
                  title={'Merge Selected Columns'}
                  visible={mergeColumnVisible} 
                  width='50%' 
                  onCancel={() => { this.setState({ mergeColumnVisible: false })}}
                  forceRender={true}
                  footer={[
                    <div>
                      <Button type="primary" onClick={() => {
                        this.setState({ mergeColumnVisible: false })
                      }}>
                        Cancel
                      </Button>
                      <Button key="submit" style={{marginLeft: '10px'}} type="primary" htmlType="submit" onClick={() => this.onColumnMergeFinish(mergeColumnOption.key, mergeColumnOption.selection, 'merge')}>
                        Merge
                      </Button>
                    </div>
                  ]}
                >
                  <Form 
                    ref={this.mergeColumnRef}
                    name={'mergeColumn'}
                  >
                    <Form.Item name="mergeParent" label="Input Merged Column Name" >
                        <Input/>
                  </Form.Item>
                  </Form>
                </Modal>
                <Modal
                  title={'Delete Nested Headers'}
                  visible={deleteNestedVisible} 
                  width='50%' 
                  onCancel={() => { this.setState({ deleteNestedVisible: false })}}
                  forceRender={true}
                  footer={[
                    <div>
                      <Button type="primary" onClick={() => {
                        this.setState({ deleteNestedVisible: false })
                      }}>
                        Cancel
                      </Button>
                      <Button key="submit" style={{marginLeft: '10px'}} type="primary" htmlType="submit" onClick={() => this.onColumnMergeFinish(mergeColumnOption.key, mergeColumnOption.selection, 'delete')}>
                        Delete
                      </Button>
                    </div>
                  ]}
                >
                  <Form 
                    ref={this.deleteNestedRef}
                    name={'deleteNestedColumn'}
                  >
                    <Form.Item name="deleteItem" label="Choose header to delete" >
                        <Input/>
                    </Form.Item>
                  </Form>
                </Modal>
                <Modal
                  title={'Create Your Column'}
                  visible={createTableColumnVisible} 
                  width='50%' 
                  onCancel={() => { this.setState({ createTableColumnVisible: false })}}
                  forceRender={true}
                  footer={[
                    <div>
                      <Button type="primary" onClick={() => {
                        this.setState({ createTableColumnVisible: false })
                      }}>
                        Cancel
                      </Button>
                      <Button key="submit" style={{marginLeft: '10px'}} type="primary" htmlType="submit" onClick={() => this.onColumnCreateFinish(createTableColumnOption.key, createTableColumnOption.selection)}>
                        Create
                      </Button>
                    </div>
                  ]}
                >
                  <Form 
                    ref={this.createColumnRef}
                    name={'createColumn'}
                  >
                    {this.createConfigForm('add')}
                  </Form>
                </Modal>
                <Modal
                  title={'Edit Cell'}
                  visible={tableCellVisible} 
                  width='50%' 
                  onCancel={() => { this.setState({ tableCellVisible: false })}}
                  forceRender={true}
                  footer={[
                    <div>
                        {columnTypeSelect != '' ? 
                            <Button type="primary" onClick={() => {
                                this.setState({ tableCellVisible: false })
                            }}>
                                Cancel
                            </Button>
                        : ''}
                        <Button key="submit" style={{marginLeft: '10px'}} type="primary" htmlType="submit" onClick={() => this.onCellCleanFinish(tableCellOption.key, tableCellOption.selection)}>
                            Clean
                        </Button>
                        <Button key="submit" style={{marginLeft: '10px'}} type="primary" htmlType="submit" onClick={() => this.onCellEditFinish(tableCellOption.key, tableCellOption.selection)}>
                            Edit
                        </Button>
                    </div>
                  ]}
                >
                    <Form 
                        ref={this.cellRef}
                        name={'editCell'}
                    >
                        {this.createConfigForm('cell')}
                    </Form>
                </Modal>
                <Modal
                  title={'Edit Your Column'}
                  visible={editTableColumnVisible} 
                  width='50%' 
                  onCancel={() => { this.setState({ editTableColumnVisible: false })}}
                  forceRender={true}
                  footer={[
                    <div>
                      <Button type="primary" onClick={() => {
                        this.setState({ editTableColumnVisible: false })
                      }}>
                        Cancel
                      </Button>
                      <Button key="submit" style={{marginLeft: '10px'}} type="primary" htmlType="submit" onClick={() => this.onColumnEditFinish(editTableColumnOption.key, editTableColumnOption.selection)}>
                        Edit
                      </Button>
                    </div>
                  ]}
                >
                  <Form 
                    ref={this.editColumnRef}
                    name={'editColumn'}
                  >
                    {this.createConfigForm('edit')}
                  </Form>
                </Modal>
            </>
        );
    }
}

export default KaleidoTable;