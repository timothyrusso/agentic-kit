import { stableRowHandlers } from '../../rules/stableRowHandlers.js';
import { ruleTester } from '../ruleTester.js';

const rule = stableRowHandlers;

ruleTester.run('stable-row-handlers', rule, {
  valid: [
    {
      name: 'a useCallback handler on the row',
      code: `const Row = memo(({ id, onPress }) => null);
export const List = ({ items }) => {
  const onPress = useCallback(id => select(id), []);
  const renderItem = useCallback(({ item }) => <Row id={item.id} onPress={onPress} />, [onPress]);
  return <FlashList data={items} renderItem={renderItem} />;
};`,
    },
    {
      name: 'a module-level handler, a prop and a ViewModel effect',
      code: `function openItem(id) {}
export const List = ({ items, onLongPress, effects }) => (
  <FlatList
    data={items}
    renderItem={({ item }) => <Row id={item.id} onPress={openItem} onLongPress={onLongPress} onShare={effects.share} />}
  />
);`,
    },
    {
      name: 'a file with no list is not checked',
      code: `const Row = memo(() => null);
export const Screen = () => <Row onPress={() => go()} />;`,
    },
    {
      name: 'elements nested inside the row are the row component business',
      code: `export const List = ({ items }) => (
  <FlashList data={items} renderItem={({ item }) => <Row id={item.id}><Button onPress={() => {}} /></Row>} />
);`,
    },
    {
      name: 'non-function props are free',
      code: `export const List = ({ items }) => (
  <FlashList data={items} renderItem={({ item }) => <Row id={item.id} style={{ flex: 1 }} title={item.title} />} />
);`,
    },
  ],
  invalid: [
    {
      name: 'an inline arrow on the renderItem component',
      code: `export const List = ({ items }) => (
  <FlashList data={items} renderItem={({ item }) => <Row id={item.id} onPress={() => select(item.id)} />} />
);`,
      errors: [{ messageId: 'inline', data: { prop: 'onPress', component: 'Row' } }],
    },
    {
      name: 'a local function on a memo component, through a named renderItem',
      code: `const Header = React.memo(() => null);
export function List({ items }) {
  const onClose = () => close();
  function renderRow({ item }) {
    return <Row id={item.id} onPress={handle} />;
    function handle() {}
  }
  return <FlashList data={items} ListHeaderComponent={<Header onClose={onClose} />} renderItem={renderRow} />;
}`,
      errors: [
        { messageId: 'unstable', data: { prop: 'onPress', component: 'Row', name: 'handle' } },
        { messageId: 'unstable', data: { prop: 'onClose', component: 'Header', name: 'onClose' } },
      ],
    },
    {
      name: 'bind and a function expression',
      code: `export const List = ({ items }) => (
  <FlatList data={items} renderItem={({ item }) => item.big ? <Big onPress={select.bind(null, item.id)} /> : <Small onPress={function () {}} />} />
);`,
      errors: [{ messageId: 'inline' }, { messageId: 'inline' }],
    },
  ],
});
