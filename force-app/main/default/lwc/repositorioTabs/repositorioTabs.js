import { LightningElement, api } from 'lwc';
import { TABS } from 'c/repositorioConfig';

export default class RepositorioTabs extends LightningElement {
    @api activeType;

    get tabsView() {
        return TABS.map((tab) => ({
            ...tab,
            className: tab.value === this.activeType ? `tab theme-${tab.theme} active` : `tab theme-${tab.theme}`
        }));
    }

    handleClick(event) {
        this.dispatchEvent(
            new CustomEvent('tipochange', {
                detail: { value: event.currentTarget.dataset.value }
            })
        );
    }
}
