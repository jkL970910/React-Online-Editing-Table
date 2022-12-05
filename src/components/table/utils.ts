import moment from 'moment';

export function getItemByID(id: string, stateData: any) {
  let res: any = {};
  if (stateData == 'testData') res = JSON.parse(localStorage.getItem(`${id}`));
  console.log(res);
  return res === null ? {uiJSON: {}} : res;
}

export function setItemByID(id: string, stateData: any) {
  stateData.uiJSON.chartType = "table";
  stateData.uiJSON.createdBy = "jkl";
  stateData.uiJSON.version = "Demo Version";
  stateData.uiJSON.uuid = "jkl-demo";
  stateData.uiJSON.createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
  localStorage.setItem(`${id}`, JSON.stringify(stateData));
}