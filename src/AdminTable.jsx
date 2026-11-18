import React from 'react';

function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return React.isValidElement(node) ? React.Children.toArray(node.props.children).map(textOf).join(' ') : '';
}

// Keep the table semantics and label each value when rows become cards on phones.
export default function AdminTable({children,className = '',...props}) {
  const sections = React.Children.toArray(children);
  const header = sections.find(part => part.type === 'thead');
  const headerRow = header && React.Children.toArray(header.props.children).find(part => part.type === 'tr');
  const labels = headerRow ? React.Children.toArray(headerRow.props.children).map(textOf) : [];
  return <table className={`${className} ad-responsive-table`} {...props}>{sections.map(section => {
    if (section.type !== 'tbody') return section;
    return React.cloneElement(section,{},React.Children.toArray(section.props.children).map(row => {
      if (!React.isValidElement(row) || row.type !== 'tr') return row;
      return React.cloneElement(row,{},React.Children.toArray(row.props.children).map((cell,index) => React.isValidElement(cell) ? React.cloneElement(cell,{'data-label':labels[index] || 'Ações'}) : cell));
    }));
  })}</table>;
}
