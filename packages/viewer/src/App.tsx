import React, { useRef, useState, useEffect, ReactNode } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Paper as MuiPaper, Card, CardContent, Tabs, Tab, List, ListItem, ListItemText, Chip, Accordion, AccordionSummary, AccordionDetails, Slider } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import * as joint from '@joint/core';
import mermaid from 'mermaid';

// 型定義
interface MethodCall {
  targetClass: string;
  targetMethod: string;
}
interface MethodCalledBy {
  callerClass: string;
  callerMethod: string;
}
interface Method {
  name: string;
  summary?: string;
  calls?: MethodCall[];
  calledBy?: MethodCalledBy[];
}
interface ClassData {
  name: string;
  namespace?: string;
  summary?: string;
  attributes?: string[];
  methods?: Method[];
  dependencies?: string[];
  implements?: string[];
  extends?: string;
}
interface InterfaceData {
  name: string;
  namespace?: string;
  methods?: Method[];
}
interface Data {
  classes?: ClassData[];
  interfaces?: InterfaceData[];
}
interface SelectedClass {
  type: 'class';
  data: ClassData;
}
interface SelectedInterface {
  type: 'interface';
  data: InterfaceData;
}
type Selected = SelectedClass | SelectedInterface | null;

const sampleData = {
  classes: [
    {
      name: 'UserController',
      layer: 'Controller',
      summary: 'ユーザー情報を取得します。',
      methods: [
        {
          name: 'GetUser',
          summary: 'ユーザー情報を取得します。',
          calls: [
            { targetClass: 'UserUseCase', targetMethod: 'GetById' }
          ],
          calledBy: [
            { callerClass: 'MainRouter', callerMethod: 'HandleRequest' }
          ]
        }
      ],
      dependencies: ['UserUseCase']
    },
    { name: 'UserUseCase', layer: 'UseCase', summary: '', methods: [], dependencies: [] }
  ],
  interfaces: [
    {
      name: 'IUserRepository',
      methods: [
        { name: 'FindById', summary: 'IDでユーザー取得' }
      ]
    }
  ]
};

const layerColors = {
  Controller: '#1976d2',
  UseCase: '#43a047',
  Repository: '#8e24aa',
  default: '#607d8b'
};

// namespaceごとにグループ化する関数（階層指定対応）
function groupByNamespace<T extends { namespace?: string; name: string }>(items: T[], level: number): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    let ns = item.namespace || '(グローバル)';
    if (ns !== '(グローバル)') {
      const parts = ns.split('.');
      ns = parts.slice(0, level).join('.') || '(グローバル)';
    }
    if (!grouped[ns]) grouped[ns] = [];
    grouped[ns].push(item);
  }
  return grouped;
}

function generateMermaidClassDiagram(data: Data) {
  let dsl = 'classDiagram\n';
  // インターフェース
  (data.interfaces || []).forEach(intf => {
    dsl += `  class ${intf.name} {\n`;
    (intf.methods || []).forEach(m => {
      dsl += `    +${m.name}()\n`;
    });
    dsl += '  }\n';
    dsl += `  <<interface>> ${intf.name}\n`;
  });
  // クラス
  (data.classes || []).forEach(cls => {
    dsl += `  class ${cls.name} {\n`;
    (cls.attributes || []).forEach(a => {
      dsl += `    ${a}\n`;
    });
    (cls.methods || []).forEach(m => {
      dsl += `    +${m.name}()\n`;
    });
    dsl += '  }\n';
  });
  // 継承・実装
  (data.classes || []).forEach(cls => {
    if (cls.extends) {
      dsl += `  ${cls.extends} <|-- ${cls.name}\n`;
    }
    (cls.implements || []).forEach(intf => {
      dsl += `  ${intf} <|.. ${cls.name}\n`;
    });
  });
  return dsl;
}

function MermaidDiagram({ code, onNodeClick }: { code: string; onNodeClick: (name: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      mermaid.initialize({ startOnLoad: false });
      ref.current.className = 'mermaid';
      ref.current.innerHTML = code;
      setTimeout(() => {
        try {
          if (!ref.current) return;
          mermaid.init(undefined, ref.current as HTMLElement);
          const svg = ref.current.querySelector('svg');
          if (!svg) return;
          const texts = svg.querySelectorAll('g.classGroup text[class^="classTitle"]');
          texts.forEach(text => {
            const t = text as HTMLElement;
            t.onclick = () => {
              const name = t.textContent?.trim();
              if (name) onNodeClick && onNodeClick(name);
            };
          });
        } catch (e) {
          // エラー握りつぶし
        }
      }, 0);
    }
  }, [code, onNodeClick]);
  return <div ref={ref} style={{ width: '100%', minHeight: 500, background: '#f9fafb', borderRadius: 8 }} />;
}

function App(): ReactNode {
  const [data, setData] = useState<Data>(sampleData);
  const [selected, setSelected] = useState<Selected>(null);
  const [tab, setTab] = useState<number>(0);
  const [namespaceLevel, setNamespaceLevel] = useState<number>(2); // デフォルト2階層

  // 選択が変わったらタブをリセット
  useEffect(() => {
    setTab(0);
  }, [selected]);

  // JSONアップロード
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target) return;
      try {
        const json = JSON.parse(event.target.result as string);
        setData(json);
        setSelected(null);
      } catch {
        alert('JSONの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  // サンプルデータセット
  const setSample = () => {
    setData(sampleData);
    setSelected(null);
  };

  // 左ペイン: クラス・インターフェース一覧（namespaceごとにグループ化）
  const classGroups = groupByNamespace(data.classes || [], namespaceLevel);
  const interfaceGroups = groupByNamespace(data.interfaces || [], namespaceLevel);
  const classCards = Object.entries(classGroups).map(([ns, classes]) => (
    <Box key={ns} mb={2}>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ pl: 1, mb: 0.5 }}>{ns}</Typography>
      {classes.map(cls => (
        <Card key={cls.name} variant="outlined" sx={{
          mb: 1,
          cursor: 'pointer',
          borderColor: selected?.data?.name === cls.name ? 'primary.main' : '#e0e3e8',
          background: '#fff',
          transition: 'background 0.2s, border-color 0.2s',
          boxShadow: selected?.data?.name === cls.name ? '0 0 0 2px #1976d233' : undefined,
          '&:hover': { background: '#f5f6fa' }
        }} onClick={() => setSelected({ type: 'class', data: cls })}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Chip label="class" size="small" sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 700 }} />
              <Typography variant="h6" color="text.primary">{cls.name}</Typography>
            </Box>
            {cls.summary && <Typography color="text.secondary" mb={1}>{cls.summary}</Typography>}
            <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
              <Chip label={`属性: ${(cls.attributes || []).length}`} size="small" sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }} />
              <Chip label={`メソッド: ${(cls.methods || []).length}`} size="small" sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }} />
            </Box>
            {(cls.dependencies && cls.dependencies.length > 0) && (
              <Typography variant="caption" color="text.secondary">依存: {cls.dependencies.join(', ')}</Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  ));
  const interfaceCards = Object.entries(interfaceGroups).map(([ns, interfaces]) => (
    <Box key={ns} mb={2}>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ pl: 1, mb: 0.5 }}>{ns}</Typography>
      {interfaces.map(intf => (
        <Card key={intf.name} variant="outlined" sx={{
          mb: 1,
          cursor: 'pointer',
          borderColor: selected?.data?.name === intf.name ? 'success.main' : '#e0e3e8',
          background: '#fff',
          transition: 'background 0.2s, border-color 0.2s',
          boxShadow: selected?.data?.name === intf.name ? '0 0 0 2px #43a04733' : undefined,
          '&:hover': { background: '#f5f6fa' }
        }} onClick={() => setSelected({ type: 'interface', data: intf })}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Chip label="interface" size="small" sx={{ bgcolor: '#43a047', color: '#fff', fontWeight: 700 }} />
              <Typography variant="h6" color="text.primary">{intf.name}</Typography>
            </Box>
            <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
              <Chip label={`メソッド: ${(intf.methods || []).length}`} size="small" sx={{ bgcolor: '#e8f5e9', color: '#388e3c' }} />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  ));

  // 右ペイン: 詳細ビュー
  let detail = (
    <Card variant="outlined" sx={{ mb: 2, bgcolor: '#fff', borderColor: '#e0e3e8' }}>
      <CardContent>
        <Typography color="text.secondary">左の一覧からクラス・インターフェースを選択してください</Typography>
      </CardContent>
    </Card>
  );
  if (selected?.type === 'class') {
    const cls = selected.data;
    detail = (
      <Card variant="outlined" sx={{ mb: 2, bgcolor: '#fff', borderColor: '#1976d2', boxShadow: '0 0 0 2px #1976d233' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Chip label="class" size="small" sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 700 }} />
            <Typography variant="h6" color="text.primary">{cls.name}</Typography>
          </Box>
          {cls.summary && <Typography color="text.secondary" mb={2}>{cls.summary}</Typography>}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} textColor="primary" indicatorColor="primary">
            <Tab label="属性" />
            <Tab label="メソッド" />
            <Tab label="依存関係" />
          </Tabs>
          {tab === 0 && (
            <List dense>
              {(cls.attributes || []).map(a => (
                <ListItem key={a}>
                  <ListItemText primary={a} />
                </ListItem>
              ))}
              {(!cls.attributes || cls.attributes.length === 0) && <ListItem><ListItemText primary="属性なし" /></ListItem>}
            </List>
          )}
          {tab === 1 && (
            <Box>
              {(cls.methods || []).map(m => (
                <Accordion key={m.name} disableGutters sx={{ mb: 1, bgcolor: '#f5f6fa' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={600} color="text.primary">{m.name}</Typography>
                    {m.summary && <Typography color="text.secondary" sx={{ ml: 2 }}>{m.summary}</Typography>}
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" fontWeight="bold">呼び出し先</Typography>
                    <List dense>
                      {(m.calls && m.calls.length > 0) ? m.calls.map(call => (
                        <ListItem key={call.targetClass + call.targetMethod}>
                          <ListItemText primary={`${call.targetClass}.${call.targetMethod}()`} />
                        </ListItem>
                      )) : <ListItem><ListItemText primary="なし" /></ListItem>}
                    </List>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>呼び出し元</Typography>
                    <List dense>
                      {(m.calledBy && m.calledBy.length > 0) ? m.calledBy.map(cb => (
                        <ListItem key={cb.callerClass + cb.callerMethod}>
                          <ListItemText primary={`${cb.callerClass}.${cb.callerMethod}()`} />
                        </ListItem>
                      )) : <ListItem><ListItemText primary="なし" /></ListItem>}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}
              {(!cls.methods || cls.methods.length === 0) && <ListItem><ListItemText primary="メソッドなし" /></ListItem>}
            </Box>
          )}
          {tab === 2 && (
            <List dense>
              {(cls.dependencies || []).map(dep => (
                <ListItem key={dep}>
                  <ListItemText primary={dep} />
                </ListItem>
              ))}
              {(!cls.dependencies || cls.dependencies.length === 0) && <ListItem><ListItemText primary="依存関係なし" /></ListItem>}
            </List>
          )}
        </CardContent>
      </Card>
    );
  }
  if (selected?.type === 'interface') {
    const intf = selected.data;
    detail = (
      <Card variant="outlined" sx={{ mb: 2, bgcolor: '#fff', borderColor: '#43a047', boxShadow: '0 0 0 2px #43a04733' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Chip label="interface" size="small" sx={{ bgcolor: '#43a047', color: '#fff', fontWeight: 700 }} />
            <Typography variant="h6" color="text.primary">{intf.name}</Typography>
          </Box>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} textColor="secondary" indicatorColor="secondary">
            <Tab label="メソッド" />
          </Tabs>
          <List dense>
            {(intf.methods || []).map(m => (
              <ListItem key={m.name}>
                <ListItemText primary={m.name} secondary={m.summary} />
              </ListItem>
            ))}
            {(!intf.methods || intf.methods.length === 0) && <ListItem><ListItemText primary="メソッドなし" /></ListItem>}
          </List>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f6fa', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <AppBar position="static" color="default" elevation={1} sx={{ mb: 2 }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" color="primary">ArchLens</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input type="file" accept="application/json" onChange={handleFileChange} style={{ display: 'none' }} id="json-upload" />
            <label htmlFor="json-upload">
              <Button variant="outlined" component="span" size="small">JSONアップロード</Button>
            </label>
            <Button variant="contained" color="primary" size="small" onClick={setSample}>サンプルデータ</Button>
          </Box>
        </Toolbar>
      </AppBar>
      {/* 2ペイン */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <MuiPaper sx={{ flex: 6, minWidth: 0, p: 2, mr: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', bgcolor: 'inherit' }}>
          {/* Namespace階層選択（スライダー） */}
          <Box sx={{ mb: 2, width: 220 }}>
            <Typography id="namespace-level-slider-label" variant="body2" color="text.secondary" gutterBottom>
              名前空間の階層: {namespaceLevel}階層まで
            </Typography>
            <Slider
              value={namespaceLevel}
              min={1}
              max={5}
              step={1}
              marks={[1,2,3,4,5].map(lvl => ({ value: lvl, label: `${lvl}` }))}
              onChange={(_, v) => setNamespaceLevel(Number(v))}
              valueLabelDisplay="auto"
              aria-labelledby="namespace-level-slider-label"
              size="small"
              sx={{ mt: 1 }}
            />
          </Box>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>クラス一覧</Typography>
          {classCards}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>インターフェース一覧</Typography>
          {interfaceCards}
        </MuiPaper>
        <MuiPaper sx={{ flex: 4, minWidth: 0, p: 3, display: 'flex', flexDirection: 'column', overflowY: 'auto', bgcolor: 'inherit' }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>詳細ビュー</Typography>
          {detail}
        </MuiPaper>
      </Box>
    </Box>
  );
}

export default App;
