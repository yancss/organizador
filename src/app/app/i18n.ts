import type { AppLanguage } from './settings-context'

export type I18n = {
  nav: {
    agenda: string
    settings: string
    signOut: string
    appName: string

    home: string
    sales: string
    salesOrders: string
    deliveries: string
    payments: string

    finance: string
    financeOverview: string
    receivables: string
    payables: string
    refunds: string
    accounts: string
    categories: string
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
  home: {
    title: string
    subtitle: string
    receivablesOpen: string
    receivablesOverdue: string
    payablesPlanned: string
    paymentsToday: string
    salesOrdersOpen: string
    deliveriesOpen: string
    deliveriesShippedToday: string
    refundsPending: string
  }
  orders: {
    title: string
    subtitle: string
    historyTitle: string
    historySubtitle: string
    new: string
    empty: string
    editHint: string
    status: string
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

    rolesLabel: string
    roleCustomer: string
    roleSupplier: string

    newTitle: string
    editTitle: string
    modalSubtitle: string
    nameLabel: string
    phoneLabel: string
    phoneHelp: string

    birthDateLabel: string

    identificationTitle: string
    idTypeLabel: string
    idNumberLabel: string
    idCountryLabel: string

    idTypeOptional: string
    idTypeTaxId: string
    idTypeNationalId: string
    idTypePassport: string
    idTypeDriverLicense: string
    idTypeResidencePermit: string
    idTypeCompanyId: string
    idTypeOther: string

    addressTitle: string
    addressCountryLabel: string
    addressPostalCodeLabel: string
    addressStateLabel: string
    addressCityLabel: string
    addressDistrictLabel: string
    addressStreetLabel: string
    addressNumberLabel: string
    addressComplementLabel: string
    addressLegacyLabel: string

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
    statusLabel: string
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
  table: {
    showing: string // placeholders: {start} {end} {total}
    page: string // placeholders: {page} {pages}
    previous: string
    next: string
    searchPlaceholder: string
    clear: string
    noResults: string
  }
  profile: {
    title: string
    subtitle: string
    loading: string
    error: string
    noUser: string

    name: string
    email: string
    birthDate: string

    save: string
    saving: string
    saved: string

    resetPassword: string
    sendingReset: string
    resetSent: string
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
    nav: {
      appName: 'Guardian',
      agenda: 'Pedidos',
      settings: 'Configurações',
      signOut: 'Sair',

      home: 'Home',
      sales: 'Vendas',
      salesOrders: 'Pedidos de venda',
      deliveries: 'Entregas',
      payments: 'Pagamentos',

      finance: 'Financeiro',
      financeOverview: 'Visão geral',
      receivables: 'Recebíveis',
      payables: 'Pagáveis',
      refunds: 'Devoluções',
      accounts: 'Contas',
      categories: 'Categorias',
    },
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
    home: {
      title: 'Home',
      subtitle: 'Resumo do dia e indicadores rápidos.',
      receivablesOpen: 'A receber (aberto)',
      receivablesOverdue: 'A receber (vencido)',
      payablesPlanned: 'A pagar (planejado)',
      paymentsToday: 'Pagamentos (hoje)',
      salesOrdersOpen: 'Pedidos (abertos)',
      deliveriesOpen: 'Entregas (em andamento)',
      deliveriesShippedToday: 'Entregas (enviadas hoje)',
      refundsPending: 'Devoluções (pendentes)',
    },
    orders: {
      title: 'Pedidos',
      subtitle: 'Pedidos a partir de hoje.',
      historyTitle: 'Histórico de pedidos',
      historySubtitle: 'Pedidos anteriores (antes de hoje).',
      new: 'Novo pedido',
      empty: 'Sem pedidos nesta lista.',
      editHint: 'Editar',
      status: 'Status',
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
      title: 'Parceiros',
      subtitle: 'Cadastre clientes e fornecedores para vincular aos pedidos.',
      new: 'Novo parceiro',
      empty: 'Nenhum cliente cadastrado.',
      editHint: 'Editar',
      phone: 'Telefone',
      noPhone: 'Sem telefone',

      rolesLabel: 'Tipo',
      roleCustomer: 'Cliente',
      roleSupplier: 'Fornecedor',

      newTitle: 'Novo parceiro',
      editTitle: 'Editar parceiro',
      modalSubtitle: 'Nome, tipo, telefone, identificação e endereço.',
      nameLabel: 'Nome',
      phoneLabel: 'Telefone',
      phoneHelp: 'Salvando em formato internacional (ex.: +351…, +55…)',

      birthDateLabel: 'Data de nascimento',

      identificationTitle: 'Identificação',
      idTypeLabel: 'Tipo',
      idNumberLabel: 'Número',
      idCountryLabel: 'País (ISO-2)',

      idTypeOptional: '(opcional)',
      idTypeTaxId: 'Tax ID / Número fiscal',
      idTypeNationalId: 'Documento nacional (ID)',
      idTypePassport: 'Passaporte',
      idTypeDriverLicense: 'Carteira de motorista',
      idTypeResidencePermit: 'Autorização/Cartão de residência',
      idTypeCompanyId: 'Registro de empresa',
      idTypeOther: 'Outro',

      addressTitle: 'Endereço',
      addressCountryLabel: 'País (ISO-2)',
      addressPostalCodeLabel: 'CEP / Código postal',
      addressStateLabel: 'Estado/Região',
      addressCityLabel: 'Cidade',
      addressDistrictLabel: 'Bairro',
      addressStreetLabel: 'Rua',
      addressNumberLabel: 'Número',
      addressComplementLabel: 'Complemento',
      addressLegacyLabel: 'Endereço (texto livre – legado)',

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
      statusLabel: 'Status',
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
    table: {
      showing: 'Mostrando {start}–{end} de {total}',
      page: 'Página {page} / {pages}',
      previous: 'Anterior',
      next: 'Próxima',
      searchPlaceholder: 'Buscar…',
      clear: 'Limpar',
      noResults: 'Nenhum registro encontrado para a busca.',
    },
    profile: {
      title: 'Perfil',
      subtitle: 'Informações da sua conta.',
      loading: 'Carregando…',
      error: 'Erro ao carregar',
      noUser: 'Nenhum usuário encontrado.',

      name: 'Nome',
      email: 'Email',
      birthDate: 'Data de nascimento',

      save: 'Salvar',
      saving: 'Salvando…',
      saved: 'Salvo.',

      resetPassword: 'Resetar senha',
      sendingReset: 'Enviando…',
      resetSent: 'Se o email existir, o link será enviado.',
    },
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
    nav: {
      appName: 'Guardian',
      agenda: 'Orders',
      settings: 'Settings',
      signOut: 'Sign out',

      home: 'Home',
      sales: 'Sales',
      salesOrders: 'Sales orders',
      deliveries: 'Deliveries',
      payments: 'Payments',

      finance: 'Finance',
      financeOverview: 'Overview',
      receivables: 'Receivables',
      payables: 'Payables',
      refunds: 'Refunds',
      accounts: 'Accounts',
      categories: 'Categories',
    },
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
    home: {
      title: 'Home',
      subtitle: 'Today summary and quick indicators.',
      receivablesOpen: 'Receivables (open)',
      receivablesOverdue: 'Receivables (overdue)',
      payablesPlanned: 'Payables (planned)',
      paymentsToday: 'Payments (today)',
      salesOrdersOpen: 'Sales orders (open)',
      deliveriesOpen: 'Deliveries (in progress)',
      deliveriesShippedToday: 'Deliveries (shipped today)',
      refundsPending: 'Refunds (pending)',
    },
    orders: {
      title: 'Orders',
      subtitle: 'Orders from today onward.',
      historyTitle: 'Order history',
      historySubtitle: 'Past orders (before today).',
      new: 'New order',
      empty: 'No orders in this list.',
      editHint: 'Edit',
      status: 'Status',
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
      title: 'Partners',
      subtitle: 'Create customers and suppliers to link to orders.',
      new: 'New partner',
      empty: 'No partners yet.',
      editHint: 'Edit',
      phone: 'Phone',
      noPhone: 'No phone',

      rolesLabel: 'Type',
      roleCustomer: 'Customer',
      roleSupplier: 'Supplier',

      newTitle: 'New partner',
      editTitle: 'Edit partner',
      modalSubtitle: 'Name, type, phone, identification and address.',
      nameLabel: 'Name',
      phoneLabel: 'Phone',
      phoneHelp: 'Saved in international format (e.g. +351…, +55…)',

      birthDateLabel: 'Birth date',

      identificationTitle: 'Identification',
      idTypeLabel: 'Type',
      idNumberLabel: 'Number',
      idCountryLabel: 'Country (ISO-2)',

      idTypeOptional: '(optional)',
      idTypeTaxId: 'Tax ID / Taxpayer number',
      idTypeNationalId: 'National ID',
      idTypePassport: 'Passport',
      idTypeDriverLicense: 'Driver\'s license',
      idTypeResidencePermit: 'Residence permit',
      idTypeCompanyId: 'Company registration',
      idTypeOther: 'Other',

      addressTitle: 'Address',
      addressCountryLabel: 'Country (ISO-2)',
      addressPostalCodeLabel: 'Postal code',
      addressStateLabel: 'State/Region',
      addressCityLabel: 'City',
      addressDistrictLabel: 'District',
      addressStreetLabel: 'Street',
      addressNumberLabel: 'Number',
      addressComplementLabel: 'Complement',
      addressLegacyLabel: 'Address (free text – legacy)',

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
      statusLabel: 'Status',
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
    table: {
      showing: 'Showing {start}–{end} of {total}',
      page: 'Page {page} / {pages}',
      previous: 'Previous',
      next: 'Next',
      searchPlaceholder: 'Search…',
      clear: 'Clear',
      noResults: 'No records found for your search.',
    },
    profile: {
      title: 'Profile',
      subtitle: 'Your account information.',
      loading: 'Loading…',
      error: 'Failed to load',
      noUser: 'No user found.',

      name: 'Name',
      email: 'Email',
      birthDate: 'Birth date',

      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved.',

      resetPassword: 'Reset password',
      sendingReset: 'Sending…',
      resetSent: 'If the email exists, the link will be sent.',
    },
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
    nav: {
      appName: 'Guardian',
      agenda: 'Pedidos',
      settings: 'Configuración',
      signOut: 'Salir',

      home: 'Inicio',
      sales: 'Ventas',
      salesOrders: 'Pedidos de venta',
      deliveries: 'Entregas',
      payments: 'Pagos',

      finance: 'Finanzas',
      financeOverview: 'Resumen',
      receivables: 'Cuentas por cobrar',
      payables: 'Cuentas por pagar',
      refunds: 'Reembolsos',
      accounts: 'Cuentas',
      categories: 'Categorías',
    },
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
    home: {
      title: 'Inicio',
      subtitle: 'Resumen del día e indicadores rápidos.',
      receivablesOpen: 'Cuentas por cobrar (abiertas)',
      receivablesOverdue: 'Cuentas por cobrar (vencidas)',
      payablesPlanned: 'Cuentas por pagar (planificadas)',
      paymentsToday: 'Pagos (hoy)',
      salesOrdersOpen: 'Pedidos de venta (abiertos)',
      deliveriesOpen: 'Entregas (en curso)',
      deliveriesShippedToday: 'Entregas (enviadas hoy)',
      refundsPending: 'Reembolsos (pendientes)',
    },
    orders: {
      title: 'Pedidos',
      subtitle: 'Pedidos desde hoy en adelante.',
      historyTitle: 'Historial de pedidos',
      historySubtitle: 'Pedidos anteriores (antes de hoy).',
      new: 'Nuevo pedido',
      empty: 'No hay pedidos en esta lista.',
      editHint: 'Editar',
      status: 'Estado',
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
      title: 'Socios',
      subtitle: 'Crea clientes y proveedores para vincularlos a pedidos.',
      new: 'Nuevo socio',
      empty: 'No hay socios.',
      editHint: 'Editar',
      phone: 'Teléfono',
      noPhone: 'Sin teléfono',

      rolesLabel: 'Tipo',
      roleCustomer: 'Cliente',
      roleSupplier: 'Proveedor',

      newTitle: 'Nuevo cliente',
      editTitle: 'Editar cliente',
      modalSubtitle: 'Nombre, teléfono, identificación y dirección.',
      nameLabel: 'Nombre',
      phoneLabel: 'Teléfono',
      phoneHelp: 'Guardado en formato internacional (p. ej. +351…, +55…)',

      birthDateLabel: 'Fecha de nacimiento',

      identificationTitle: 'Identificación',
      idTypeLabel: 'Tipo',
      idNumberLabel: 'Número',
      idCountryLabel: 'País (ISO-2)',

      idTypeOptional: '(opcional)',
      idTypeTaxId: 'Tax ID / Número fiscal',
      idTypeNationalId: 'Documento nacional (ID)',
      idTypePassport: 'Pasaporte',
      idTypeDriverLicense: 'Permiso de conducir',
      idTypeResidencePermit: 'Permiso de residencia',
      idTypeCompanyId: 'Registro de empresa',
      idTypeOther: 'Otro',

      addressTitle: 'Dirección',
      addressCountryLabel: 'País (ISO-2)',
      addressPostalCodeLabel: 'Código postal',
      addressStateLabel: 'Estado/Región',
      addressCityLabel: 'Ciudad',
      addressDistrictLabel: 'Barrio/Distrito',
      addressStreetLabel: 'Calle',
      addressNumberLabel: 'Número',
      addressComplementLabel: 'Complemento',
      addressLegacyLabel: 'Dirección (texto libre – legado)',

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
      statusLabel: 'Estado',
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
    table: {
      showing: 'Mostrando {start}–{end} de {total}',
      page: 'Página {page} / {pages}',
      previous: 'Anterior',
      next: 'Siguiente',
      searchPlaceholder: 'Buscar…',
      clear: 'Limpiar',
      noResults: 'No se encontraron registros para la búsqueda.',
    },
    profile: {
      title: 'Perfil',
      subtitle: 'Información de tu cuenta.',
      loading: 'Cargando…',
      error: 'Error al cargar',
      noUser: 'No se encontró usuario.',

      name: 'Nombre',
      email: 'Correo',
      birthDate: 'Fecha de nacimiento',

      save: 'Guardar',
      saving: 'Guardando…',
      saved: 'Guardado.',

      resetPassword: 'Restablecer contraseña',
      sendingReset: 'Enviando…',
      resetSent: 'Si el correo existe, el enlace será enviado.',
    },
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
