import React from 'react';
import styles from './index.css';
import Main from '../components/main';
import 'antd/dist/antd.min.css';

export default function() {
  return (
    <div className={styles.normal}>
      <Main />
    </div>
  );
}
