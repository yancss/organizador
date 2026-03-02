import type { AppLanguage } from './settings-context'

export type I18n = {
  nav: {
    agenda: string
    settings: string
    signOut: string
    appName: string
  }
  board: {
    title: string
    subtitle: string
    viewList: string
    viewCalendar: string
    new: string
    empty: string
    noDateSection: string
    noDateEmpty: string
    editHint: string
  }
  orders: {
    title: string
    subtitle: string
    historyTitle: string
    historySubtitle: string
    new: string
    empty: string
    editHint: string
    delivered: string
    client: string
    noClient: string
    value: string
    deliveryAt: string
    noDeliveryAt: string
  }
  products: {
    title: string
    subtitle: string
    new: string
    empty: string
    editHint: string
    unit: string

    newTitle: string
    editTitle: string
    modalSubtitle: string
    nameLabel: string
    brandLabel: string
    kindLabel: string
    kindRaw: string
    kindFinished: string
    unitLabel: string

    delete: string
    deleteConfirm: string
  }
  clients: {
    title: string
    subtitle: string
    new: string
    empty: string
    editHint: string
    phone: string
    noPhone: string

    newTitle: string
    editTitle: string
    modalSubtitle: string
    nameLabel: string
    phoneLabel: string
    addressLabel: string
    observationsLabel: string

    delete: string
    deleteConfirm: string
  }
  inventory: {
    title: string
    subtitle: string
    empty: string
    editHint: string

    quantity: string
    minimum: string
    noMinimum: string
    belowMinimum: string

    editTitle: string
    modalSubtitle: string
    quantityLabel: string
    minimumLabel: string
  }
  recipes: {
    title: string
    subtitle: string
    new: string
    empty: string
    editHint: string

    newTitle: string
    editTitle: string
    modalSubtitle: string

    finalProduct: string
    yield: string
    observations: string

    itemsTitle: string
    addItem: string
    removeItem: string
    noItems: string
    saveToAddItems: string
    qtyPlaceholder: string

    itemsCount: string

    delete: string
    deleteConfirm: string
    deleteItemConfirm: string
  }
  modal: {
    newTitle: string
    editTitle: string
    subtitle: string
    titleLabel: string
    notesLabel: string
    startLabel: string
    endLabel: string
    allDay: string
    cancel: string
    save: string
    delete: string
    deleteConfirm: string
    optional: string

    // Orders
    newTitleOrder: string
    editTitleOrder: string
    subtitleOrder: string
    orderNameLabel: string
    orderNamePlaceholder: string
    clientLabel: string
    clientNone: string
    orderedAtLabel: string
    deliveryAtLabel: string
    deliveredLabel: string
    valueLabel: string
    observationsLabel: string
    itemsTitle: string
    addItem: string
    removeItem: string
    noItems: string
    quantityPlaceholder: string
    deleteConfirmOrder: string
  }
  calendar: {
    today: string
    month: string
    week: string
    day: string
    list: string
  }
  settings: {
    title: string
    subtitle: string
    language: string
    theme: string
    currency: string
    eur: string
    brl: string
    usd: string
    light: string
    dark: string
  }
}

const dict: Record<AppLanguage, I18n> = {
  pt: {
    nav: { appName: 'Guardian', agenda: 'Pedidos', settings: 'Configurações', signOut: 'Sair' },
    board: {
      title: 'Agenda',
      subtitle: 'Eventos e notas em lista e no calendário.',
      viewList: 'Lista',
      viewCalendar: 'Calendário',
      new: 'Novo',
      empty: 'Sem eventos ainda. Clique em “Novo”.',
      noDateSection: 'Sem data',
      noDateEmpty: 'Nenhuma nota sem data.',
      editHint: 'Editar',
    },
    orders: {
      title: 'Pedidos',
      subtitle: 'Pedidos a partir de hoje.',
      historyTitle: 'Histórico de pedidos',
      historySubtitle: 'Pedidos anteriores (antes de hoje).',
      new: 'Novo pedido',
      empty: 'Sem pedidos nesta lista.',
      editHint: 'Editar',
      delivered: 'Entregue',
      client: 'Cliente',
      noClient: 'Sem cliente',
      value: 'Valor',
      deliveryAt: 'Entrega',
      noDeliveryAt: 'Sem data de entrega',
    },
    products: {
      title: 'Produtos',
      subtitle: 'Cadastre produtos e defina a unidade padrão.',
      new: 'Novo produto',
      empty: 'Nenhum produto cadastrado.',
      editHint: 'Editar',
      unit: 'Unidade',

      newTitle: 'Novo produto',
      editTitle: 'Editar produto',
      modalSubtitle: 'Nome, marca e unidade padrão.',
      nameLabel: 'Nome',
      brandLabel: 'Marca',
      kindLabel: 'Tipo',
      kindRaw: 'Matéria-prima',
      kindFinished: 'Produto final',
      unitLabel: 'Unidade',

      delete: 'Desativar',
      deleteConfirm: 'Desativar este produto?',
    },
    clients: {
      title: 'Clientes',
      subtitle: 'Cadastre clientes para vincular aos pedidos.',
      new: 'Novo cliente',
      empty: 'Nenhum cliente cadastrado.',
      editHint: 'Editar',
      phone: 'Telefone',
      noPhone: 'Sem telefone',

      newTitle: 'Novo cliente',
      editTitle: 'Editar cliente',
      modalSubtitle: 'Nome, telefone e observações.',
      nameLabel: 'Nome',
      phoneLabel: 'Telefone',
      addressLabel: 'Endereço',
      observationsLabel: 'Observações',

      delete: 'Excluir',
      deleteConfirm: 'Excluir este cliente?',
    },
    inventory: {
      title: 'Estoque',
      subtitle: 'Acompanhe quantidade atual e estoque mínimo.',
      empty: 'Nenhum item de estoque ainda.',
      editHint: 'Editar',

      quantity: 'Quantidade',
      minimum: 'Mínimo',
      noMinimum: 'Sem mínimo',
      belowMinimum: 'Abaixo do estoque mínimo',

      editTitle: 'Editar estoque',
      modalSubtitle: 'Ajuste a quantidade atual e o mínimo.',
      quantityLabel: 'Quantidade atual',
      minimumLabel: 'Estoque mínimo',
    },
    recipes: {
      title: 'Receitas',
      subtitle: 'Cadastre receitas para produtos finais usando matérias-primas.',
      new: 'Nova receita',
      empty: 'Nenhuma receita cadastrada.',
      editHint: 'Editar',

      newTitle: 'Nova receita',
      editTitle: 'Editar receita',
      modalSubtitle: 'Produto final, rendimento e itens (matérias-primas).',

      finalProduct: 'Produto final',
      yield: 'Rendimento (opcional)',
      observations: 'Observações',

      itemsTitle: 'Itens da receita',
      addItem: 'Adicionar',
      removeItem: 'Remover',
      noItems: 'Sem itens ainda.',
      saveToAddItems: 'Salve a receita primeiro para adicionar itens.',
      qtyPlaceholder: 'Qtd',

      itemsCount: 'Itens',

      delete: 'Excluir receita',
      deleteConfirm: 'Excluir esta receita?',
      deleteItemConfirm: 'Remover este item da receita?',
    },
    modal: {
      newTitle: 'Novo evento',
      editTitle: 'Editar evento',
      subtitle: 'Título, notas e data/hora.',
      titleLabel: 'Título',
      notesLabel: 'Notas',
      startLabel: 'Início',
      endLabel: 'Fim',
      allDay: 'Dia inteiro',
      cancel: 'Cancelar',
      save: 'Salvar',
      delete: 'Eliminar',
      deleteConfirm: 'Eliminar este evento?',
      optional: 'Opcional',

      newTitleOrder: 'Novo pedido',
      editTitleOrder: 'Editar pedido',
      subtitleOrder: 'Cliente, datas, itens, valor e observações.',
      orderNameLabel: 'Pedido',
      orderNamePlaceholder: 'Ex.: Bolo de chocolate',
      clientLabel: 'Cliente',
      clientNone: '— (sem cliente) —',
      orderedAtLabel: 'Data do pedido',
      deliveryAtLabel: 'Data de entrega',
      deliveredLabel: 'Entregue?',
      valueLabel: 'Valor',
      observationsLabel: 'Observações',
      itemsTitle: 'Itens do pedido',
      addItem: 'Adicionar item',
      removeItem: 'Remover',
      noItems: 'Sem itens ainda. Adicione pelo menos um produto se quiser controlar quantidades.',
      quantityPlaceholder: 'Qtd',
      deleteConfirmOrder: 'Eliminar este pedido?',
    },
    calendar: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia', list: 'Lista' },
    settings: {
      title: 'Configurações',
      subtitle: 'Idioma, tema e moeda da aplicação.',
      language: 'Idioma',
      theme: 'Tema',
      currency: 'Moeda',
      eur: 'Euro (€)',
      brl: 'Real (R$)',
      usd: 'Dólar (US$)',
      light: 'Claro',
      dark: 'Escuro',
    },
  },
  en: {
    nav: { appName: 'Guardian', agenda: 'Orders', settings: 'Settings', signOut: 'Sign out' },
    board: {
      title: 'Agenda',
      subtitle: 'Events and notes in a list and on the calendar.',
      viewList: 'List',
      viewCalendar: 'Calendar',
      new: 'New',
      empty: 'No events yet. Click “New”.',
      noDateSection: 'No date',
      noDateEmpty: 'No undated notes.',
      editHint: 'Edit',
    },
    orders: {
      title: 'Orders',
      subtitle: 'Orders from today onward.',
      historyTitle: 'Order history',
      historySubtitle: 'Past orders (before today).',
      new: 'New order',
      empty: 'No orders in this list.',
      editHint: 'Edit',
      delivered: 'Delivered',
      client: 'Client',
      noClient: 'No client',
      value: 'Value',
      deliveryAt: 'Delivery',
      noDeliveryAt: 'No delivery date',
    },
    products: {
      title: 'Products',
      subtitle: 'Create products and define the default unit.',
      new: 'New product',
      empty: 'No products yet.',
      editHint: 'Edit',
      unit: 'Unit',

      newTitle: 'New product',
      editTitle: 'Edit product',
      modalSubtitle: 'Name, brand and default unit.',
      nameLabel: 'Name',
      brandLabel: 'Brand',
      kindLabel: 'Type',
      kindRaw: 'Raw material',
      kindFinished: 'Finished product',
      unitLabel: 'Unit',

      delete: 'Deactivate',
      deleteConfirm: 'Deactivate this product?',
    },
    clients: {
      title: 'Clients',
      subtitle: 'Create clients to link them to orders.',
      new: 'New client',
      empty: 'No clients yet.',
      editHint: 'Edit',
      phone: 'Phone',
      noPhone: 'No phone',

      newTitle: 'New client',
      editTitle: 'Edit client',
      modalSubtitle: 'Name, phone and notes.',
      nameLabel: 'Name',
      phoneLabel: 'Phone',
      addressLabel: 'Address',
      observationsLabel: 'Observations',

      delete: 'Delete',
      deleteConfirm: 'Delete this client?',
    },
    inventory: {
      title: 'Inventory',
      subtitle: 'Track current quantity and minimum stock.',
      empty: 'No inventory items yet.',
      editHint: 'Edit',

      quantity: 'Quantity',
      minimum: 'Minimum',
      noMinimum: 'No minimum',
      belowMinimum: 'Below minimum stock',

      editTitle: 'Edit inventory',
      modalSubtitle: 'Adjust current quantity and minimum.',
      quantityLabel: 'Current quantity',
      minimumLabel: 'Minimum stock',
    },
    recipes: {
      title: 'Recipes',
      subtitle: 'Create recipes for finished products using raw materials.',
      new: 'New recipe',
      empty: 'No recipes yet.',
      editHint: 'Edit',

      newTitle: 'New recipe',
      editTitle: 'Edit recipe',
      modalSubtitle: 'Final product, yield and items (raw materials).',

      finalProduct: 'Final product',
      yield: 'Yield (optional)',
      observations: 'Observations',

      itemsTitle: 'Recipe items',
      addItem: 'Add',
      removeItem: 'Remove',
      noItems: 'No items yet.',
      saveToAddItems: 'Save the recipe first to add items.',
      qtyPlaceholder: 'Qty',

      itemsCount: 'Items',

      delete: 'Delete recipe',
      deleteConfirm: 'Delete this recipe?',
      deleteItemConfirm: 'Remove this item from the recipe?',
    },
    modal: {
      newTitle: 'New event',
      editTitle: 'Edit event',
      subtitle: 'Title, notes, and date/time.',
      titleLabel: 'Title',
      notesLabel: 'Notes',
      startLabel: 'Start',
      endLabel: 'End',
      allDay: 'All day',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      deleteConfirm: 'Delete this event?',
      optional: 'Optional',

      newTitleOrder: 'New order',
      editTitleOrder: 'Edit order',
      subtitleOrder: 'Client, dates, items, value, and notes.',
      orderNameLabel: 'Order',
      orderNamePlaceholder: 'E.g.: Chocolate cake',
      clientLabel: 'Client',
      clientNone: '— (no client) —',
      orderedAtLabel: 'Order date',
      deliveryAtLabel: 'Delivery date',
      deliveredLabel: 'Delivered?',
      valueLabel: 'Value',
      observationsLabel: 'Observations',
      itemsTitle: 'Order items',
      addItem: 'Add item',
      removeItem: 'Remove',
      noItems: 'No items yet. Add at least one product if you want quantity control.',
      quantityPlaceholder: 'Qty',
      deleteConfirmOrder: 'Delete this order?',
    },
    calendar: { today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'List' },
    settings: {
      title: 'Settings',
      subtitle: 'Application language, theme and currency.',
      language: 'Language',
      theme: 'Theme',
      currency: 'Currency',
      eur: 'Euro (€)',
      brl: 'Brazilian real (R$)',
      usd: 'US dollar ($)',
      light: 'Light',
      dark: 'Dark',
    },
  },
  es: {
    nav: { appName: 'Guardian', agenda: 'Pedidos', settings: 'Configuración', signOut: 'Salir' },
    board: {
      title: 'Agenda',
      subtitle: 'Eventos y notas en lista y en el calendario.',
      viewList: 'Lista',
      viewCalendar: 'Calendario',
      new: 'Nuevo',
      empty: 'Aún no hay eventos. Haz clic en “Nuevo”.',
      noDateSection: 'Sin fecha',
      noDateEmpty: 'No hay notas sin fecha.',
      editHint: 'Editar',
    },
    orders: {
      title: 'Pedidos',
      subtitle: 'Pedidos desde hoy en adelante.',
      historyTitle: 'Historial de pedidos',
      historySubtitle: 'Pedidos anteriores (antes de hoy).',
      new: 'Nuevo pedido',
      empty: 'No hay pedidos en esta lista.',
      editHint: 'Editar',
      delivered: 'Entregado',
      client: 'Cliente',
      noClient: 'Sin cliente',
      value: 'Valor',
      deliveryAt: 'Entrega',
      noDeliveryAt: 'Sin fecha de entrega',
    },
    products: {
      title: 'Productos',
      subtitle: 'Crea productos y define la unidad por defecto.',
      new: 'Nuevo producto',
      empty: 'No hay productos.',
      editHint: 'Editar',
      unit: 'Unidad',

      newTitle: 'Nuevo producto',
      editTitle: 'Editar producto',
      modalSubtitle: 'Nombre, marca y unidad por defecto.',
      nameLabel: 'Nombre',
      brandLabel: 'Marca',
      kindLabel: 'Tipo',
      kindRaw: 'Materia prima',
      kindFinished: 'Producto final',
      unitLabel: 'Unidad',

      delete: 'Desactivar',
      deleteConfirm: '¿Desactivar este producto?',
    },
    clients: {
      title: 'Clientes',
      subtitle: 'Crea clientes para vincularlos a pedidos.',
      new: 'Nuevo cliente',
      empty: 'No hay clientes.',
      editHint: 'Editar',
      phone: 'Teléfono',
      noPhone: 'Sin teléfono',

      newTitle: 'Nuevo cliente',
      editTitle: 'Editar cliente',
      modalSubtitle: 'Nombre, teléfono y observaciones.',
      nameLabel: 'Nombre',
      phoneLabel: 'Teléfono',
      addressLabel: 'Dirección',
      observationsLabel: 'Observaciones',

      delete: 'Eliminar',
      deleteConfirm: '¿Eliminar este cliente?',
    },
    inventory: {
      title: 'Inventario',
      subtitle: 'Controla cantidad actual y stock mínimo.',
      empty: 'No hay ítems de inventario.',
      editHint: 'Editar',

      quantity: 'Cantidad',
      minimum: 'Mínimo',
      noMinimum: 'Sin mínimo',
      belowMinimum: 'Por debajo del stock mínimo',

      editTitle: 'Editar inventario',
      modalSubtitle: 'Ajusta cantidad actual y mínimo.',
      quantityLabel: 'Cantidad actual',
      minimumLabel: 'Stock mínimo',
    },
    recipes: {
      title: 'Recetas',
      subtitle: 'Crea recetas para productos finales usando materias primas.',
      new: 'Nueva receta',
      empty: 'No hay recetas.',
      editHint: 'Editar',

      newTitle: 'Nueva receta',
      editTitle: 'Editar receta',
      modalSubtitle: 'Producto final, rendimiento e ítems (materias primas).',

      finalProduct: 'Producto final',
      yield: 'Rendimiento (opcional)',
      observations: 'Observaciones',

      itemsTitle: 'Ítems de la receta',
      addItem: 'Añadir',
      removeItem: 'Quitar',
      noItems: 'Sin ítems.',
      saveToAddItems: 'Guarda la receta primero para añadir ítems.',
      qtyPlaceholder: 'Cant.',

      itemsCount: 'Ítems',

      delete: 'Eliminar receta',
      deleteConfirm: '¿Eliminar esta receta?',
      deleteItemConfirm: '¿Quitar este ítem de la receta?',
    },
    modal: {
      newTitle: 'Nuevo evento',
      editTitle: 'Editar evento',
      subtitle: 'Título, notas y fecha/hora.',
      titleLabel: 'Título',
      notesLabel: 'Notas',
      startLabel: 'Inicio',
      endLabel: 'Fin',
      allDay: 'Todo el día',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      deleteConfirm: '¿Eliminar este evento?',
      optional: 'Opcional',

      newTitleOrder: 'Nuevo pedido',
      editTitleOrder: 'Editar pedido',
      subtitleOrder: 'Cliente, fechas, ítems, valor y observaciones.',
      orderNameLabel: 'Pedido',
      orderNamePlaceholder: 'Ej.: Pastel de chocolate',
      clientLabel: 'Cliente',
      clientNone: '— (sin cliente) —',
      orderedAtLabel: 'Fecha del pedido',
      deliveryAtLabel: 'Fecha de entrega',
      deliveredLabel: '¿Entregado?',
      valueLabel: 'Valor',
      observationsLabel: 'Observaciones',
      itemsTitle: 'Ítems del pedido',
      addItem: 'Añadir ítem',
      removeItem: 'Quitar',
      noItems: 'Sin ítems. Añade al menos un producto si quieres controlar cantidades.',
      quantityPlaceholder: 'Cant.',
      deleteConfirmOrder: '¿Eliminar este pedido?',
    },
    calendar: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista' },
    settings: {
      title: 'Configuración',
      subtitle: 'Idioma, tema y moneda de la aplicación.',
      language: 'Idioma',
      theme: 'Tema',
      currency: 'Moneda',
      eur: 'Euro (€)',
      brl: 'Real (R$)',
      usd: 'Dólar (US$)',
      light: 'Claro',
      dark: 'Oscuro',
    },
  },
}

export function t(language: AppLanguage): I18n {
  return dict[language]
}
