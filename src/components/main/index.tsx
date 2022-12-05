import React from 'react';
import { Button, Modal, Form, Input, InputNumber, Select } from 'antd';
import DemoTable from '../table/table';
import { getItemByID, setItemByID } from '../table/utils';
import { FormInstance } from 'antd/es/form';
import 'handsontable/dist/handsontable.full.css';

type MProps = {};

const addLayout = {
    labelCol: { span: 5 },
    wrapperCol: { span: 15 },
};

const tailLayout = {
    wrapperCol: { offset: 8, span: 16 },
};

class Main extends React.Component<MProps> {
    state = {
        localData: 'testData',
        addViewVisible: false,
        submitLoading: false,
        preConfig: {
            colNum: 3,
            colConfig: {},
        },
    };
    formRef = React.createRef<FormInstance>();

    onFinish = (e: any) => {
        const dataUsed = { ...e };
        const { preConfig } = this.state;
    
        dataUsed.uiJSON.preConfig = preConfig;
        setItemByID('testID', dataUsed);
        this.setState({chartItem: dataUsed, addViewVisible: false});
    };

    genDataByColNum(colNum: any) {
        const { colConfig } = this.state.preConfig;
        const initData = [];
        for (let i = 0; i < colNum; i++) {
          initData.push({name: `${String.fromCharCode(65 + i)}`, dataType: 'string'});
        }
        colConfig['data'] = initData;
        this.setState({preConfig: {colNum, colConfig}});
    }

    changeTableColumn(value: any) {
        this.genDataByColNum(value);
    }

    render(): JSX.Element {
        const { 
            addViewVisible,
            localData,
            preConfig,
            submitLoading,
        } = this.state;
        const chartItem: any = getItemByID('testID', localData);
        const { uiJSON } = chartItem;
        return (
            <>
                {Object.keys(uiJSON).length > 0 ? 
                    <DemoTable uuid={'testID'} canvasID={'testCanvas'} parentThis={this} preConfig={uiJSON?.preConfig} />
                :
                    <Button onClick={() => {this.setState({addViewVisible: true})}}>Create a Table</Button>
                }
                <Modal 
                    title={'Create a Table'} 
                    visible={addViewVisible} 
                    footer={null} 
                    onCancel={() => { this.setState({addViewVisible: false}) }}
                    width='100%'
                    forceRender={true}
                >
                    <Form {...addLayout} 
                        name="nest-messages" 
                        onFinish={this.onFinish} 
                        ref={this.formRef}
                        onValuesChange={(changedValues, allValues) => {
                            console.log(changedValues, allValues);
                        }}
                    >
                        {
                            <Form.Item name={["uiJSON", "title"]} label={"Table Name"} rules={[{ required: true }]}>
                                <Input style={{ width: 200, display: 'inline-block', marginRight: '6px' }}/>
                            </Form.Item>
                        }
                        {
                            <Form.Item name={["uiJSON", "preConfig", "colNum"]} label={"Table Column"} rules={[{ required: true }]}>
                                <InputNumber min={1} value={preConfig?.colNum || 3} onChange={(value: any) => {this.changeTableColumn(value)}} />
                            </Form.Item>
                        }
                        {
                            preConfig?.colConfig['data'] ? 
                            preConfig?.colConfig['data'].map((o: any) => {
                                return (
                                    <Form.Item label={"Column Config"} rules={[{ required: true }]}>
                                        <div style={{ width: 250, display: 'flex' }}>
                                            <Input style={{ width: 200, display: 'inline-block', marginRight: '6px' }} value={o.name} placeholder={"Column Name"} onChange={(e: any) => {o.name = e.target.value; this.setState({preConfig})}} />
                                            <Select
                                                style={{ width: 200 }}
                                                placeholder={'Data type'}
                                                value={o.dataType}
                                                onChange={(e: any) => {o.dataType = e; this.setState({preConfig})}}
                                            >
                                                <Select.Option value="string">String</Select.Option>
                                                <Select.Option value="integer">Integer</Select.Option>
                                                <Select.Option value="float">Float</Select.Option>
                                            </Select>
                                        </div>
                                    </Form.Item>
                                );
                            }) : ''
                        }
                        
                        <Form.Item {...tailLayout}>
                            <Button type="primary" htmlType="submit" loading={submitLoading}>
                                Submit
                            </Button>
                            <Button type="primary" style={{marginLeft: '10px'}} onClick={() => {
                                this.setState({addType: null, addViewVisible: false})
                            }}>
                                Cancel
                            </Button>
                        </Form.Item>
                    </Form>
                </Modal>
            </>
        );
    }
}

export default Main;