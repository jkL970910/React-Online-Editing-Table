import React, { useState, useRef } from 'react';
import { Form, Space, Input, Select, Button, Tooltip, Tag, Row, Col, message } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect } from 'react';
import './index.css';
import {Controlled as CodeMirror} from 'react-codemirror2';
import copy from 'copy-to-clipboard';
import 'codemirror/lib/codemirror.css';
import 'codemirror/lib/codemirror.js';
import 'codemirror/theme/blackboard.css';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/mode/python/python.js';
import 'codemirror/mode/clike/clike.js';

export const CreateColorSchema = (props: any) => {
  const {schemaType, changeType = () => {}} = props;
  return(
    <>
      <Form.List name="colorSchema">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, fieldKey, ...restField }) => (
              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item>
                  <Select placeholder="Schema Type" defaultValue={schemaType} onChange={(value: any) => {changeType(value)}}>
                    <>
                      <Select.Option value="range">Data Range</Select.Option>
                      <Select.Option value="string">String Match</Select.Option>
                    </>
                  </Select>
                </Form.Item>
                {schemaType === 'range' ? 
                  <>
                    <Form.Item
                      {...restField}
                      name={[name, 'start']}
                      fieldKey={[fieldKey, 'start']}
                      rules={[{ required: true, message: 'Missing range start' }]}
                    >
                      <Input placeholder="Start From" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'end']}
                      fieldKey={[fieldKey, 'end']}
                      rules={[{ required: true, message: 'Missing range end' }]}
                    >
                    <Input placeholder="End To" />
                  </Form.Item>
                  </>
                : ''}
                {schemaType === 'string' ? 
                  <>
                    <Form.Item
                      {...restField}
                      name={[name, 'strMatch']}
                      fieldKey={[fieldKey, 'strMatch']}
                      rules={[{ required: true, message: 'Missing String Match' }]}
                    >
                      <Input placeholder="String Match" />
                    </Form.Item>
                  </>
                : ''}
                <Form.Item
                  {...restField}
                  name={[name, 'color']}
                  fieldKey={[fieldKey, 'color']}
                  rules={[{ required: true, message: 'Missing background color' }]}
                >
                  <Input placeholder="Background Color" />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, 'text']}
                  fieldKey={[fieldKey, 'text']}
                  rules={[{ required: true, message: 'Missing text color' }]}
                >
                  <Select placeholder="Text Color" >
                    <>
                      <Select.Option value="black">Black</Select.Option>
                      <Select.Option value="white">White</Select.Option>
                    </>
                  </Select>
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} />
              </Space>
            ))}
            <Form.Item>
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Add Range
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </>
  );
}

export interface DescriptionItemProps {
  title: any;
  content: any;
};

export const DescriptionItem: React.FC<DescriptionItemProps> = (props) => {
  const { title, content } = props
  return (
    <div style={{ display: "flex"}}>
      <p style={{ fontWeight: 'bold'}}>{title}: </p>
      <p style={{ marginLeft: '12px'}}>{content}</p>
    </div>
  );
}

export interface DescriptionBarProps {
  item: any
};

export const DescriptionBar: React.FC<DescriptionBarProps> = (props) => {
  const { item } = props;

  return (
    <Row>
      <Col span={12}>
        <DescriptionItem title="Title" content={item?.uiJSON?.title} />
      </Col>
      <Col span={12}>
        <DescriptionItem title="Type" content={item?.uiJSON?.chartType} />
      </Col>
      <Col span={12}>
        <DescriptionItem title="Owner" content={item?.uiJSON?.createdBy} />
      </Col>
      <Col span={12}>
        <DescriptionItem title="ID" content={item?.uiJSON?.uuid} />
      </Col>
      <Col span={12}>
        <DescriptionItem title="Version" content={item?.uiJSON?.version} />
      </Col>
      <Col span={24}>
        <DescriptionItem title="Last Update Commit" content={item?.uiJSON?.commit} />
      </Col>
      <Col span={24}>
        <DescriptionItem title="Update At" content={item?.uiJSON?.createdAt} />
      </Col>
  </Row>
  );
}

export interface EditableTagGroupProps {
  dropdownoptions: any;
  parentThis: any;
};

export const EditableTagGroup: React.FC<EditableTagGroupProps> = (props) => {
    
  const {dropdownoptions, parentThis} = props;

  let inputRef = useRef(null);
  let editInputRef = useRef(null);
  const [tags, setTags] = useState(dropdownoptions?.pretags || []);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editInputIndex, setEditInputIndex] = useState(-1);
  const [editInputValue, setEditInputValue] = useState('');

  useEffect(() => {
    parentThis.setState({dataRenderOption: {...parentThis.state.dataRenderOption, dropdownoptions: {pretags: tags}}})
  }, [tags]);

  const handleClose = (removedTag: any) => {
    const curTags = tags.filter((tag: any) => tag !== removedTag);
    setTags(curTags);
  }

  const showInput = () => {
    setInputVisible(true);
  }

  const handleInputChange = (e: any) => {
    setInputValue(e.target.value);
  }

  const handleInputConfirm = () => {
    if (inputValue && tags && tags.indexOf(inputValue) === -1) {
      setTags([...tags, inputValue]);
      setInputVisible(false);
      setInputValue('');
    }
  }

  const handleEditInputChange = (e: any) => {
    setEditInputValue(e.target.value);
  }

  const handleEditInputConfirm = () => {
    const newTags = [...tags];
    newTags[editInputIndex] = editInputValue;
    setTags(newTags);
    setEditInputIndex(-1);
    setEditInputValue('');
  }

  return (
    <>
      <div style={{display: 'inline-flex'}}>
        {tags ? tags.map((tag: any, index: any) => {
          if (editInputIndex === index) {
            return (
              <Input
                ref={editInputRef}
                key={tag}
                size="small"
                className="tag-input"
                value={editInputValue}
                onChange={handleEditInputChange}
                onBlur={handleEditInputConfirm}
                onPressEnter={handleEditInputConfirm}
              />
            );
          }

          const isLongTag = tag.length > 20;

          const tagElem = (
            <Tag
              className="edit-tag"
              key={tag}
              closable={index !== -1}
              onClose={() => handleClose(tag)}
            >
              <span
                onDoubleClick={e => {
                  if (index !== 0) {
                    setEditInputIndex(index);
                    setEditInputValue(tag);
                    editInputRef.current.focus();
                    e.preventDefault();
                  }
                }}
              >
                {isLongTag ? `${tag.slice(0, 20)}...` : tag}
              </span>
            </Tag>
          );
          return isLongTag ? (
            <Tooltip title={tag} key={tag}>
              {tagElem}
            </Tooltip>
          ) : (
            tagElem
          );
        }) : ''}
        {inputVisible && (
          <Input
            ref={inputRef}
            type="text"
            size="small"
            className="tag-input"
            style={{display: 'inline-block'}}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputConfirm}
            onPressEnter={handleInputConfirm}
          />
        )}
        {!inputVisible && (
          <Tag className="site-tag-plus" onClick={showInput}>
            <PlusOutlined /> New Dropdown Index
          </Tag>
        )}
      </div>
    </>
  );
}

interface TableCodeViewProps {
  url?: any;
}

export const TableCodeView: React.FC<TableCodeViewProps> = (props: any) => {

  const [codeValue, setCodeValue] = useState(props.url);
  const [codeMode, setCodeMode] = useState('python');

  const mirrorOption = {
    lineNumbers: true,
    mode: { name: codeMode },
    autofocus: true,
    styleActiveLine: true,
    lineWrapping: true,
    theme: 'blackboard',
    foldGutter: true,
  }

  const copyCode = () => {
    if (copy(codeValue, {
      debug: true,
    })) message.success('copy success')
  }
  
  return (
    <>
      <Select
        style={{ width: 200, display: 'inline-block', marginBottom: '8px' }}
        placeholder={`Select a code type`}
        value={codeMode}
        onChange={(value: any) => {setCodeMode(value)}}
      >
        {/* <Select.Option value="javascript">Javascript</Select.Option> */}
        <Select.Option value="python">Python</Select.Option>
        {/* <Select.Option value="clike">C/C++</Select.Option> */}
      </Select>
      <Button style={{ marginLeft: '8px'}} onClick={copyCode}>Copy</Button>
      <CodeMirror 
        value={codeValue}
        options={mirrorOption}
        onBeforeChange={(editor: any, data: any, value: any) => {
          console.log(value);
          setCodeValue(value);
        }}
      />
    </>
  );
}