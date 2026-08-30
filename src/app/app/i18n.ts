import type { AppLanguage } from './settings-context'

export type I18n = {
  nav: {
    agenda: string
    settings: string
    signOut: string
    appName: string

    home: string
    sales: string
    salesQuotes: string
    salesOrders: string
    deliveries: string
    payments: string

    purchases: string
    purchaseOrders: string

    products: string
    inventory: string
    recipes: string
    costs: string

    admin: string
    adminUsers: string
    adminRolesPermissions: string
    adminAudits: string
    adminSettings: string
    adminObjects: string

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
    payablesCommitted: string
    paymentsToday: string
    quotesPending: string
    salesOrdersInProgress: string
    approvalsPending: string
    inventoryCritical: string
    deliveriesOpen: string
    deliveriesOverdue: string
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

    entityTypeLabel: string
    entityTypePerson: string
    entityTypeCompany: string

    countryLabel: string
    lookupPostalCode: string
    selectPlaceholder: string

    emailLabel: string

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
    addressStateLabelBR: string
    addressStateLabelPT: string

    addressCityLabel: string
    addressCityLabelBR: string
    addressCityLabelPT: string

    addressDistrictLabel: string
    addressDistrictLabelBR: string
    addressDistrictLabelPT: string

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
  toast: {
    entities: {
      order: string
      purchaseOrder: string
      invite: string
      user: string
      role: string
      security: string
      product: string
      client: string
      recipe: string
      inventory: string
      account: string
      category: string
      entry: string
      costCenter: string
      event: string
      task: string
      delivery: string
      receivable: string
      generic: string
    }
    created: string // placeholder: {entity}
    updated: string // placeholder: {entity}
    deleted: string // placeholder: {entity}
    failedToSave: string
    failedToDelete: string
    alreadyExistsEmail: string
  }
  form: {
    requiredMark: string
    requiredHint: string
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
  admin: {
    common: {
      failedToLoad: string
      failedToSave: string
      invalidValue: string
      nameTooShort: string
      system: string
      custom: string
      active: string
      inactive: string
      noEmailPlaceholder: string
    }
    users: {
      title: string
      subtitle: string
      name: string
      email: string
      role: string
      actions: string
      resetPassword: string
      edit: string
      deactivate: string
      deactivateConfirm: string
      inactive: string
      noEmail: string
      workspaceRole: string
      customRole: string
      noneRole: string
      oneRoleHelp: string
      save: string
      cancel: string
      editUser: string
      sessionHours: string
      sessionHoursHelp: string
      adminBypassHelp: string
    }
    roles: {
      title: string
      subtitle: string
      createTitle: string
      createNamePlaceholder: string
      createDescPlaceholder: string
      create: string
      module: string
      view: string
      edit: string
      savePerms: string
      pending: string
      tip: string
      open: string
      close: string
      moduleNames: {
        sales: string
        purchases: string
        inventory: string
        products: string
        clients: string
        finance: string
        admin: string
      }
    }
    security: {
      title: string
      subtitle: string
      tabUsers: string
      tabRoles: string

      sessionPerUserTitle: string
      loading: string
      failedLoadUsers: string
      maxAgeHours: string
      maxAgePlaceholder: string
      maxAgeHelp: string
      saveAndKick: string

      rolesWorkspaceTitle: string
      failedLoadRoles: string
    }
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

  common: {
    loading: string
    loadError: string
    close: string
    closeMenu: string
    lightTheme: string
    darkTheme: string
    all: string

    menuProfile: string
    menuSettings: string
    menuLogout: string

    audit: {
      createdAt: string
      updatedAt: string
      createdBy: string
      updatedBy: string
      unknownUser: string
    }
  }

  costs: {
    title: string
    subtitle: string
    newCostCenter: string
    totalPaidLast30Days: string
    reportByCenter30d: string
    costCenters: string

    emptyReport: string
    emptyCostCenters: string

    columns: {
      center: string
      total: string
      entries: string
      name: string
      actions: string
    }

    renamePrompt: string
    rename: string

    disableConfirm: string
    disable: string

    modal: {
      title: string
      subtitleExample: string
      nameLabel: string
      cancel: string
      save: string
    }
  }

  financePage: {
    title: string
    subtitle: string
    accounts: string
    categories: string
    newEntry: string

    view: string
    viewAll: string
    viewReceivable: string
    viewPayable: string

    filters: {
      from: string
      to: string
      account: string
      category: string
      clear: string
    }

    cards: {
      income: string
      expense: string
      net: string
    }

    empty: string

    columns: {
      name: string
      date: string
      type: string
      amount: string
      category: string
      costCenter: string
      account: string
      actions: string
    }

    types: {
      income: string
      expense: string
    }

    actions: {
      edit: string
      delete: string
      deleteConfirm: string
    }

    modal: {
      titleNew: string
      subtitle: string
      id: string
      type: string
      status: string
      statusPaid: string
      statusPlanned: string
      date: string
      amount: string
      amountPlaceholder: string
      account: string
      accountPlaceholder: string
      noAccountsTip: string
      category: string
      costCenter: string
      name: string
      observations: string
      cancel: string
      save: string
      readOnly: string
    }
  }

  homePage: {
    loading: string
    loadError: string
    count: {
      titleOne: string
      titleMany: string
      entryOne: string
      entryMany: string
      paymentOne: string
      paymentMany: string
    }
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
      salesQuotes: 'Orçamentos',
      salesOrders: 'Pedidos de venda',
      deliveries: 'Entregas',
      payments: 'Pagamentos',

      purchases: 'Compras',
      purchaseOrders: 'Pedidos de compra',

      products: 'Produtos',
      inventory: 'Estoque',
      recipes: 'Receitas',
      costs: 'Custos',

      admin: 'Admin',
      adminUsers: 'Usuários',
      adminRolesPermissions: 'Roles & permissões',
      adminAudits: 'Auditorias',
      adminSettings: 'Configurações',
      adminObjects: 'Objetos',

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
      payablesCommitted: 'A pagar (comprometido)',
      paymentsToday: 'Pagamentos (hoje)',
      quotesPending: 'Orcamentos (pendentes)',
      salesOrdersInProgress: 'Pedidos (em execucao)',
      approvalsPending: 'Aprovacoes (pendentes)',
      inventoryCritical: 'Reposicao critica',
      deliveriesOpen: 'Entregas (em andamento)',
      deliveriesOverdue: 'Entregas (atrasadas)',
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
      modalSubtitle: '',
      nameLabel: 'Nome',
      phoneLabel: 'Telefone',
      phoneHelp: '',

      entityTypeLabel: 'Tipo de parceiro',
      entityTypePerson: 'Pessoa Física',
      entityTypeCompany: 'Pessoa Jurídica',

      countryLabel: 'País',
      lookupPostalCode: 'Buscar',
      selectPlaceholder: 'Selecione…',

      emailLabel: 'Email',

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
      addressCountryLabel: 'País',
      addressPostalCodeLabel: 'CEP / Código postal',

      addressStateLabel: 'Estado/Região',
      addressStateLabelBR: 'UF',
      addressStateLabelPT: 'Distrito',

      addressCityLabel: 'Cidade',
      addressCityLabelBR: 'Cidade',
      addressCityLabelPT: 'Concelho',

      addressDistrictLabel: 'Bairro',
      addressDistrictLabelBR: 'Bairro',
      addressDistrictLabelPT: 'Localidade',

      addressStreetLabel: 'Rua',
      addressNumberLabel: 'Número',
      addressComplementLabel: 'Complemento',
      addressLegacyLabel: 'Endereço',

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
    toast: {
      entities: {
        order: 'Pedido',
        purchaseOrder: 'Pedido de compra',
        invite: 'Convite',
        user: 'Usuário',
        role: 'Perfil',
        security: 'Segurança',
        product: 'Produto',
        client: 'Parceiro',
        recipe: 'Receita',
        inventory: 'Estoque',
        account: 'Conta',
        category: 'Categoria',
        entry: 'Lançamento',
        costCenter: 'Centro de custo',
        event: 'Evento',
        task: 'Tarefa',
        delivery: 'Entrega',
        receivable: 'Recebível',
        generic: 'Registro',
      },
      created: '{entity} criado.',
      updated: '{entity} atualizado.',
      deleted: '{entity} excluído.',
      failedToSave: 'Falha ao salvar.',
      failedToDelete: 'Falha ao excluir.',
      alreadyExistsEmail: 'Já existe um usuário com esse e-mail.',
    },
    form: {
      requiredMark: '*',
      requiredHint: 'Obrigatório',
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
    admin: {
      common: {
        failedToLoad: 'Falha ao carregar {what}: {error}',
        failedToSave: 'Falha ao salvar',
        invalidValue: 'Valor inválido.',
        nameTooShort: 'Nome muito curto',
        system: 'system',
        custom: 'custom',
        active: 'ativo',
        inactive: 'inativo',
        noEmailPlaceholder: '(sem email)',
      },
      users: {
        title: 'Admin · Usuários',
        subtitle: 'Lista de usuários do workspace atual.',
        name: 'Nome',
        email: 'Email',
        role: 'Role',
        actions: 'Ações',
        resetPassword: 'Reset senha',
        edit: 'Editar',
        deactivate: 'Desativar',
        deactivateConfirm:
          'Desativar o usuário {name}?\n\nEle será deslogado e não conseguirá entrar até ser reativado.',
        inactive: 'inativo',
        noEmail: 'Usuário sem email',
        workspaceRole: 'Workspace role',
        customRole: 'Role (custom)',
        noneRole: '(sem role)',
        oneRoleHelp: 'Apenas 1 role por usuário',
        save: 'Salvar',
        cancel: 'Cancelar',
        editUser: 'Editar usuário',
        sessionHours: 'Sessão (horas)',
        sessionHoursHelp: 'vazio = padrão',
        adminBypassHelp: 'Admin bypass total',
      },
      roles: {
        title: 'Admin · Roles & permissões',
        subtitle: 'Configure o que cada perfil pode visualizar e editar em cada módulo.',
        createTitle: 'Criar role',
        createNamePlaceholder: 'Ex.: Financeiro',
        createDescPlaceholder: 'Descrição (opcional)',
        create: 'Criar',
        module: 'Módulo',
        view: 'Visualizar',
        edit: 'Editar',
        savePerms: 'Salvar permissões',
        pending: 'pendente',
        tip: 'Dica: marcar Editar também marca Visualizar. Desmarcar Visualizar remove Editar.',
        open: 'Abrir',
        close: 'Fechar',
        moduleNames: {
          sales: 'Vendas',
          purchases: 'Compras',
          inventory: 'Estoque',
          products: 'Produtos',
          clients: 'Clientes',
          finance: 'Financeiro',
          admin: 'Administração',
        },
      },
      security: {
        title: 'Admin · Segurança',
        subtitle:
          'Sessões JWT expiram por padrão em 4 horas (fixo). Você pode sobrescrever por usuário e derrubar sessões ativas imediatamente.',
        tabUsers: 'Usuários',
        tabRoles: 'Roles & Permissões',

        sessionPerUserTitle: 'Expiração de sessão por usuário',
        loading: 'Carregando…',
        failedLoadUsers: 'Falha ao carregar usuários: {error}',
        maxAgeHours: 'MaxAge (horas)',
        maxAgePlaceholder: '4',
        maxAgeHelp: 'vazio = padrão (4h)',
        saveAndKick: 'Salvar e derrubar sessões',

        rolesWorkspaceTitle: 'Roles & Permissões (por workspace)',
        failedLoadRoles: 'Falha ao carregar roles: {error}',
      },
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

    common: {
      loading: 'Carregando…',
      loadError: 'Erro ao carregar.',
      close: 'Fechar',
      closeMenu: 'Fechar menu',
      lightTheme: 'Tema claro',
      darkTheme: 'Tema escuro',
      all: 'Todas',

      menuProfile: 'Perfil',
      menuSettings: 'Configurações',
      menuLogout: 'Sair',

      audit: {
        createdAt: 'Criado em',
        updatedAt: 'Atualizado em',
        createdBy: 'Criado por',
        updatedBy: 'Atualizado por',
        unknownUser: '(usuário desconhecido)',
      },
    },

    costs: {
      title: 'Custos',
      subtitle: 'Centros de custo e relatório simples (últimos 30 dias).',
      newCostCenter: 'Novo centro de custo',
      totalPaidLast30Days: 'Total de saídas (pago) nos últimos 30 dias',
      reportByCenter30d: 'Relatório por centro (30d)',
      costCenters: 'Centros de custo',

      emptyReport: 'Sem dados.',
      emptyCostCenters: 'Nenhum centro de custo.',

      columns: {
        center: 'Centro',
        total: 'Total',
        entries: 'Lanç.',
        name: 'Nome',
        actions: 'Ações',
      },

      renamePrompt: 'Novo nome do centro:',
      rename: 'Renomear',

      disableConfirm: 'Desativar este centro de custo?',
      disable: 'Desativar',

      modal: {
        title: 'Novo centro de custo',
        subtitleExample: 'Ex.: Produção, Delivery, Administrativo, Loja…',
        nameLabel: 'Nome',
        cancel: 'Cancelar',
        save: 'Salvar',
      },
    },

    financePage: {
      title: 'Financeiro',
      subtitle: 'Lançamentos, contas e visão rápida do caixa.',
      accounts: 'Contas',
      categories: 'Categorias',
      newEntry: 'Novo lançamento',

      view: 'Visão',
      viewAll: 'Tudo',
      viewReceivable: 'A receber',
      viewPayable: 'A pagar',

      filters: {
        from: 'De',
        to: 'Até',
        account: 'Conta',
        category: 'Categoria',
        clear: 'Limpar filtros',
      },

      cards: {
        income: 'Entradas',
        expense: 'Saídas',
        net: 'Saldo',
      },

      empty: 'Nenhum lançamento ainda.',

      columns: {
        name: 'Nome',
        date: 'Data',
        type: 'Tipo',
        amount: 'Valor',
        category: 'Categoria',
        costCenter: 'Centro de custo',
        account: 'Conta',
        actions: 'Ações',
      },

      types: {
        income: 'Entrada',
        expense: 'Saída',
      },

      actions: {
        edit: 'Editar',
        delete: 'Excluir',
        deleteConfirm: 'Excluir este lançamento?',
      },

      modal: {
        titleNew: 'Novo lançamento',
        subtitle: 'Registre entradas/saídas e vincule a categoria e centro de custo.',
        id: 'ID',
        type: 'Tipo',
        status: 'Status',
        statusPaid: 'Pago',
        statusPlanned: 'Previsto',
        date: 'Data (competência)',
        amount: 'Valor',
        amountPlaceholder: '0,00',
        account: 'Conta',
        accountPlaceholder: 'Selecione…',
        noAccountsTip: 'Dica: crie uma conta (ex.: Caixa) em /api/finance/accounts (vamos colocar UI disso depois).',
        category: 'Categoria',
        costCenter: 'Centro de custo',
        name: 'Nome',
        observations: 'Observações',
        cancel: 'Cancelar',
        save: 'Salvar',
        readOnly: 'Somente leitura',
      },
    },

    homePage: {
      loading: 'Carregando…',
      loadError: 'Erro ao carregar.',
      count: {
        titleOne: 'título',
        titleMany: 'títulos',
        entryOne: 'lançamento',
        entryMany: 'lançamentos',
        paymentOne: 'pagamento',
        paymentMany: 'pagamentos',
      },
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
      salesQuotes: 'Quotes',
      salesOrders: 'Sales orders',
      deliveries: 'Deliveries',
      payments: 'Payments',

      purchases: 'Purchases',
      purchaseOrders: 'Purchase orders',

      products: 'Products',
      inventory: 'Inventory',
      recipes: 'Recipes',
      costs: 'Costs',

      admin: 'Admin',
      adminUsers: 'Users',
      adminRolesPermissions: 'Roles & permissions',
      adminAudits: 'Audits',
      adminSettings: 'Settings',
      adminObjects: 'Objects',

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
      payablesCommitted: 'Payables (committed)',
      paymentsToday: 'Payments (today)',
      quotesPending: 'Quotes (pending)',
      salesOrdersInProgress: 'Sales orders (in progress)',
      approvalsPending: 'Approvals (pending)',
      inventoryCritical: 'Critical replenishment',
      deliveriesOpen: 'Deliveries (in progress)',
      deliveriesOverdue: 'Deliveries (overdue)',
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
      modalSubtitle: '',
      nameLabel: 'Name',
      phoneLabel: 'Phone',
      phoneHelp: '',

      entityTypeLabel: 'Partner type',
      entityTypePerson: 'Individual',
      entityTypeCompany: 'Company',

      countryLabel: 'Country',
      lookupPostalCode: 'Lookup',
      selectPlaceholder: 'Select…',

      emailLabel: 'Email',

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
      addressCountryLabel: 'Country',
      addressPostalCodeLabel: 'Postal code / ZIP',

      addressStateLabel: 'State/Region',
      addressStateLabelBR: 'State',
      addressStateLabelPT: 'District',

      addressCityLabel: 'City',
      addressCityLabelBR: 'City',
      addressCityLabelPT: 'Council',

      addressDistrictLabel: 'District',
      addressDistrictLabelBR: 'District',
      addressDistrictLabelPT: 'Locality',

      addressStreetLabel: 'Street',
      addressNumberLabel: 'Number',
      addressComplementLabel: 'Complement',
      addressLegacyLabel: 'Address',

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
    toast: {
      entities: {
        order: 'Order',
        purchaseOrder: 'Purchase order',
        invite: 'Invite',
        user: 'User',
        role: 'Role',
        security: 'Security',
        product: 'Product',
        client: 'Partner',
        recipe: 'Recipe',
        inventory: 'Inventory',
        account: 'Account',
        category: 'Category',
        entry: 'Entry',
        costCenter: 'Cost center',
        event: 'Event',
        task: 'Task',
        delivery: 'Delivery',
        receivable: 'Receivable',
        generic: 'Record',
      },
      created: '{entity} created.',
      updated: '{entity} updated.',
      deleted: '{entity} deleted.',
      failedToSave: 'Failed to save.',
      failedToDelete: 'Failed to delete.',
      alreadyExistsEmail: 'A user with this email already exists.',
    },
    form: {
      requiredMark: '*',
      requiredHint: 'Required',
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
    admin: {
      common: {
        failedToLoad: 'Failed to load {what}: {error}',
        failedToSave: 'Failed to save',
        invalidValue: 'Invalid value.',
        nameTooShort: 'Name is too short',
        system: 'system',
        custom: 'custom',
        active: 'active',
        inactive: 'inactive',
        noEmailPlaceholder: '(no email)',
      },
      users: {
        title: 'Admin · Users',
        subtitle: 'Users in the current workspace.',
        name: 'Name',
        email: 'Email',
        role: 'Role',
        actions: 'Actions',
        resetPassword: 'Reset password',
        edit: 'Edit',
        deactivate: 'Deactivate',
        deactivateConfirm:
          'Deactivate user {name}?\n\nThey will be signed out and won\'t be able to log in until reactivated.',
        inactive: 'inactive',
        noEmail: 'User has no email',
        workspaceRole: 'Workspace role',
        customRole: 'Custom role',
        noneRole: '(no role)',
        oneRoleHelp: 'Only one role per user',
        save: 'Save',
        cancel: 'Cancel',
        editUser: 'Edit user',
        sessionHours: 'Session (hours)',
        sessionHoursHelp: 'empty = default',
        adminBypassHelp: 'Admin full bypass',
      },
      roles: {
        title: 'Admin · Roles & permissions',
        subtitle: 'Configure what each role can view and edit in each module.',
        createTitle: 'Create role',
        createNamePlaceholder: 'e.g. Finance',
        createDescPlaceholder: 'Description (optional)',
        create: 'Create',
        module: 'Module',
        view: 'View',
        edit: 'Edit',
        savePerms: 'Save permissions',
        pending: 'pending',
        tip: 'Tip: enabling Edit also enables View. Disabling View disables Edit.',
        open: 'Open',
        close: 'Close',
        moduleNames: {
          sales: 'Sales',
          purchases: 'Purchases',
          inventory: 'Inventory',
          products: 'Products',
          clients: 'Clients',
          finance: 'Finance',
          admin: 'Administration',
        },
      },
      security: {
        title: 'Admin · Security',
        subtitle:
          'JWT sessions expire by default in 4 hours (fixed). You can override per user and immediately revoke active sessions.',
        tabUsers: 'Users',
        tabRoles: 'Roles & permissions',

        sessionPerUserTitle: 'Session expiration per user',
        loading: 'Loading…',
        failedLoadUsers: 'Failed to load users: {error}',
        maxAgeHours: 'MaxAge (hours)',
        maxAgePlaceholder: '4',
        maxAgeHelp: 'empty = default (4h)',
        saveAndKick: 'Save & revoke sessions',

        rolesWorkspaceTitle: 'Roles & permissions (per workspace)',
        failedLoadRoles: 'Failed to load roles: {error}',
      },
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

    common: {
      loading: 'Loading…',
      loadError: 'Failed to load.',
      close: 'Close',
      closeMenu: 'Close menu',
      lightTheme: 'Light theme',
      darkTheme: 'Dark theme',
      all: 'All',

      menuProfile: 'Profile',
      menuSettings: 'Settings',
      menuLogout: 'Logout',

      audit: {
        createdAt: 'Created at',
        updatedAt: 'Updated at',
        createdBy: 'Created by',
        updatedBy: 'Updated by',
        unknownUser: '(unknown user)',
      },
    },

    costs: {
      title: 'Costs',
      subtitle: 'Cost centers and simple report (last 30 days).',
      newCostCenter: 'New cost center',
      totalPaidLast30Days: 'Total expense (paid) last 30 days',
      reportByCenter30d: 'By cost center (30d)',
      costCenters: 'Cost centers',

      emptyReport: 'No data.',
      emptyCostCenters: 'No cost centers.',

      columns: {
        center: 'Center',
        total: 'Total',
        entries: 'Entries',
        name: 'Name',
        actions: 'Actions',
      },

      renamePrompt: 'New center name:',
      rename: 'Rename',

      disableConfirm: 'Disable this cost center?',
      disable: 'Disable',

      modal: {
        title: 'New cost center',
        subtitleExample: 'Example: Production, Delivery, Admin…',
        nameLabel: 'Name',
        cancel: 'Cancel',
        save: 'Save',
      },
    },

    financePage: {
      title: 'Finance',
      subtitle: 'Entries, accounts and quick view.',
      accounts: 'Accounts',
      categories: 'Categories',
      newEntry: 'New entry',

      view: 'View',
      viewAll: 'All',
      viewReceivable: 'Receivable',
      viewPayable: 'Payable',

      filters: {
        from: 'From',
        to: 'To',
        account: 'Account',
        category: 'Category',
        clear: 'Clear filters',
      },

      cards: {
        income: 'Income',
        expense: 'Expense',
        net: 'Net',
      },

      empty: 'No entries yet.',

      columns: {
        name: 'Name',
        date: 'Date',
        type: 'Type',
        amount: 'Amount',
        category: 'Category',
        costCenter: 'Cost center',
        account: 'Account',
        actions: 'Actions',
      },

      types: {
        income: 'Income',
        expense: 'Expense',
      },

      actions: {
        edit: 'Edit',
        delete: 'Delete',
        deleteConfirm: 'Delete this entry?',
      },

      modal: {
        titleNew: 'New entry',
        subtitle: 'Register income/expense and link category and cost center.',
        id: 'ID',
        type: 'Type',
        status: 'Status',
        statusPaid: 'Paid',
        statusPlanned: 'Planned',
        date: 'Date',
        amount: 'Amount',
        amountPlaceholder: '0.00',
        account: 'Account',
        accountPlaceholder: 'Select…',
        noAccountsTip: 'Tip: create an account first.',
        category: 'Category',
        costCenter: 'Cost center',
        name: 'Name',
        observations: 'Notes',
        cancel: 'Cancel',
        save: 'Save',
        readOnly: 'Read-only',
      },
    },

    homePage: {
      loading: 'Loading…',
      loadError: 'Failed to load.',
      count: {
        titleOne: 'item',
        titleMany: 'items',
        entryOne: 'entry',
        entryMany: 'entries',
        paymentOne: 'payment',
        paymentMany: 'payments',
      },
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
      salesQuotes: 'Presupuestos',
      salesOrders: 'Pedidos de venta',
      deliveries: 'Entregas',
      payments: 'Pagos',

      purchases: 'Compras',
      purchaseOrders: 'Pedidos de compra',

      products: 'Productos',
      inventory: 'Inventario',
      recipes: 'Recetas',
      costs: 'Costos',

      admin: 'Admin',
      adminUsers: 'Usuarios',
      adminRolesPermissions: 'Roles y permisos',
      adminAudits: 'Auditorías',
      adminSettings: 'Configuración',
      adminObjects: 'Objetos',

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
      payablesCommitted: 'Cuentas por pagar (comprometidas)',
      paymentsToday: 'Pagos (hoy)',
      quotesPending: 'Presupuestos (pendientes)',
      salesOrdersInProgress: 'Pedidos de venta (en ejecucion)',
      approvalsPending: 'Aprobaciones (pendientes)',
      inventoryCritical: 'Reposicion critica',
      deliveriesOpen: 'Entregas (en curso)',
      deliveriesOverdue: 'Entregas (atrasadas)',
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

      newTitle: 'Nuevo socio',
      editTitle: 'Editar socio',
      modalSubtitle: '',
      nameLabel: 'Nombre',
      phoneLabel: 'Teléfono',
      phoneHelp: '',

      entityTypeLabel: 'Tipo de socio',
      entityTypePerson: 'Persona física',
      entityTypeCompany: 'Persona jurídica',

      countryLabel: 'País',
      lookupPostalCode: 'Buscar',
      selectPlaceholder: 'Seleccione…',

      emailLabel: 'Email',

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
      addressCountryLabel: 'País',
      addressPostalCodeLabel: 'Código postal / CEP',

      addressStateLabel: 'Estado/Región',
      addressStateLabelBR: 'UF',
      addressStateLabelPT: 'Distrito',

      addressCityLabel: 'Ciudad',
      addressCityLabelBR: 'Ciudad',
      addressCityLabelPT: 'Municipio',

      addressDistrictLabel: 'Distrito',
      addressDistrictLabelBR: 'Barrio',
      addressDistrictLabelPT: 'Localidad',

      addressStreetLabel: 'Calle',
      addressNumberLabel: 'Número',
      addressComplementLabel: 'Complemento',
      addressLegacyLabel: 'Dirección',

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
    toast: {
      entities: {
        order: 'Pedido',
        purchaseOrder: 'Pedido de compra',
        invite: 'Invitación',
        user: 'Usuario',
        role: 'Rol',
        security: 'Seguridad',
        product: 'Producto',
        client: 'Socio',
        recipe: 'Receta',
        inventory: 'Inventario',
        account: 'Cuenta',
        category: 'Categoría',
        entry: 'Asiento',
        costCenter: 'Centro de costo',
        event: 'Evento',
        task: 'Tarea',
        delivery: 'Entrega',
        receivable: 'Por cobrar',
        generic: 'Registro',
      },
      created: '{entity} creado.',
      updated: '{entity} actualizado.',
      deleted: '{entity} eliminado.',
      failedToSave: 'Error al guardar.',
      failedToDelete: 'Error al eliminar.',
      alreadyExistsEmail: 'Ya existe un usuario con ese email.',
    },
    form: {
      requiredMark: '*',
      requiredHint: 'Obligatorio',
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
    admin: {
      common: {
        failedToLoad: 'Error al cargar {what}: {error}',
        failedToSave: 'Error al guardar',
        invalidValue: 'Valor inválido.',
        nameTooShort: 'Nombre demasiado corto',
        system: 'system',
        custom: 'custom',
        active: 'activo',
        inactive: 'inactivo',
        noEmailPlaceholder: '(sin correo)',
      },
      users: {
        title: 'Admin · Usuarios',
        subtitle: 'Usuarios del workspace actual.',
        name: 'Nombre',
        email: 'Correo',
        role: 'Rol',
        actions: 'Acciones',
        resetPassword: 'Restablecer contraseña',
        edit: 'Editar',
        deactivate: 'Desactivar',
        deactivateConfirm:
          '¿Desactivar al usuario {name}?\n\nSerá desconectado y no podrá iniciar sesión hasta ser reactivado.',
        inactive: 'inactivo',
        noEmail: 'Usuario sin correo',
        workspaceRole: 'Rol del workspace',
        customRole: 'Rol (custom)',
        noneRole: '(sin rol)',
        oneRoleHelp: 'Solo 1 rol por usuario',
        save: 'Guardar',
        cancel: 'Cancelar',
        editUser: 'Editar usuario',
        sessionHours: 'Sesión (horas)',
        sessionHoursHelp: 'vacío = predeterminado',
        adminBypassHelp: 'Bypass total de admin',
      },
      roles: {
        title: 'Admin · Roles y permisos',
        subtitle: 'Configura lo que cada rol puede ver y editar en cada módulo.',
        createTitle: 'Crear rol',
        createNamePlaceholder: 'Ej.: Finanzas',
        createDescPlaceholder: 'Descripción (opcional)',
        create: 'Crear',
        module: 'Módulo',
        view: 'Ver',
        edit: 'Editar',
        savePerms: 'Guardar permisos',
        pending: 'pendiente',
        tip: 'Tip: marcar Editar también marca Ver. Desmarcar Ver quita Editar.',
        open: 'Abrir',
        close: 'Cerrar',
        moduleNames: {
          sales: 'Ventas',
          purchases: 'Compras',
          inventory: 'Inventario',
          products: 'Productos',
          clients: 'Clientes',
          finance: 'Finanzas',
          admin: 'Administración',
        },
      },
      security: {
        title: 'Admin · Seguridad',
        subtitle:
          'Las sesiones JWT expiran por defecto en 4 horas (fijo). Puedes sobrescribir por usuario y revocar sesiones activas inmediatamente.',
        tabUsers: 'Usuarios',
        tabRoles: 'Roles y permisos',

        sessionPerUserTitle: 'Expiración de sesión por usuario',
        loading: 'Cargando…',
        failedLoadUsers: 'Error al cargar usuarios: {error}',
        maxAgeHours: 'MaxAge (horas)',
        maxAgePlaceholder: '4',
        maxAgeHelp: 'vacío = predeterminado (4h)',
        saveAndKick: 'Guardar y revocar sesiones',

        rolesWorkspaceTitle: 'Roles y permisos (por workspace)',
        failedLoadRoles: 'Error al cargar roles: {error}',
      },
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

    common: {
      loading: 'Cargando…',
      loadError: 'Error al cargar.',
      close: 'Cerrar',
      closeMenu: 'Cerrar menú',
      lightTheme: 'Tema claro',
      darkTheme: 'Tema oscuro',
      all: 'Todas',

      menuProfile: 'Perfil',
      menuSettings: 'Configuración',
      menuLogout: 'Salir',

      audit: {
        createdAt: 'Creado el',
        updatedAt: 'Actualizado el',
        createdBy: 'Creado por',
        updatedBy: 'Actualizado por',
        unknownUser: '(usuario desconocido)',
      },
    },

    costs: {
      title: 'Costos',
      subtitle: 'Centros de costo y reporte simple (últimos 30 días).',
      newCostCenter: 'Nuevo centro',
      totalPaidLast30Days: 'Total de gastos (pagado) últimos 30 días',
      reportByCenter30d: 'Reporte por centro (30d)',
      costCenters: 'Centros de costo',

      emptyReport: 'Sin datos.',
      emptyCostCenters: 'Sin centros.',

      columns: {
        center: 'Centro',
        total: 'Total',
        entries: 'Mov.',
        name: 'Nombre',
        actions: 'Acciones',
      },

      renamePrompt: 'Nuevo nombre del centro:',
      rename: 'Renombrar',

      disableConfirm: '¿Desactivar este centro?',
      disable: 'Desactivar',

      modal: {
        title: 'Nuevo centro de costo',
        subtitleExample: 'Ej.: Producción, Delivery, Administrativo…',
        nameLabel: 'Nombre',
        cancel: 'Cancelar',
        save: 'Guardar',
      },
    },

    financePage: {
      title: 'Finanzas',
      subtitle: 'Movimientos, cuentas y vista rápida.',
      accounts: 'Cuentas',
      categories: 'Categorías',
      newEntry: 'Nuevo',

      view: 'Vista',
      viewAll: 'Todo',
      viewReceivable: 'Por cobrar',
      viewPayable: 'Por pagar',

      filters: {
        from: 'De',
        to: 'Hasta',
        account: 'Cuenta',
        category: 'Categoría',
        clear: 'Limpiar filtros',
      },

      cards: {
        income: 'Ingresos',
        expense: 'Gastos',
        net: 'Balance',
      },

      empty: 'Sin movimientos.',

      columns: {
        name: 'Nombre',
        date: 'Fecha',
        type: 'Tipo',
        amount: 'Importe',
        category: 'Categoría',
        costCenter: 'Centro de costo',
        account: 'Cuenta',
        actions: 'Acciones',
      },

      types: {
        income: 'Ingreso',
        expense: 'Gasto',
      },

      actions: {
        edit: 'Editar',
        delete: 'Eliminar',
        deleteConfirm: '¿Eliminar este movimiento?',
      },

      modal: {
        titleNew: 'Nuevo movimiento',
        subtitle: 'Registra ingresos/gastos y vincula categoría y centro de costo.',
        id: 'ID',
        type: 'Tipo',
        status: 'Estado',
        statusPaid: 'Pagado',
        statusPlanned: 'Previsto',
        date: 'Fecha',
        amount: 'Importe',
        amountPlaceholder: '0.00',
        account: 'Cuenta',
        accountPlaceholder: 'Seleccione…',
        noAccountsTip: 'Tip: crea una cuenta primero.',
        category: 'Categoría',
        costCenter: 'Centro de costo',
        name: 'Nombre',
        observations: 'Notas',
        cancel: 'Cancelar',
        save: 'Guardar',
        readOnly: 'Solo lectura',
      },
    },

    homePage: {
      loading: 'Cargando…',
      loadError: 'Error al cargar.',
      count: {
        titleOne: 'título',
        titleMany: 'títulos',
        entryOne: 'asiento',
        entryMany: 'asientos',
        paymentOne: 'pago',
        paymentMany: 'pagos',
      },
    },
  },
}

export function t(language: AppLanguage): I18n {
  return dict[language]
}
