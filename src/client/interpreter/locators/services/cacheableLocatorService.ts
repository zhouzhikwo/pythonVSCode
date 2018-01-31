import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { createDeferred, Deferred } from '../../../common/helpers';
import { IPersistentStateFactory } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterLocatorService, PythonInterpreter } from '../../contracts';

@injectable()
export abstract class CacheableLocatorService implements IInterpreterLocatorService {
    private getInterpretersPromise: Deferred<PythonInterpreter[]>;
    constructor(private readonly name: string,
        protected readonly serviceContainer: IServiceContainer) {
    }
    public abstract dispose();
    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        if (!this.getInterpretersPromise) {
            this.getInterpretersPromise = createDeferred<PythonInterpreter[]>();
            this.getInterpretersImplementation(resource)
                .then(items => {
                    this.cacheInterpreters(items);
                    this.getInterpretersPromise.resolve(items);
                })
                .catch(ex => this.getInterpretersPromise.reject(ex));
        }
        if (this.getInterpretersPromise.completed) {
            return this.getInterpretersPromise.promise;
        }

        const cachedInterpreters = this.getCachedInterpreters();
        return Array.isArray(cachedInterpreters) ? cachedInterpreters : this.getInterpretersPromise.promise;
    }

    protected abstract getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]>;

    private getCachedInterpreters() {
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        // tslint:disable-next-line:no-any
        const globalPersistence = persistentFactory.createGlobalPersistentState<PythonInterpreter[]>(`INTERPRETERS_CACHE_${this.name}`, undefined as any);
        if (!Array.isArray(globalPersistence.value)) {
            return;
        }
        return globalPersistence.value.map(item => {
            return {
                ...item,
                cachedEntry: true
            };
        });
    }
    private cacheInterpreters(interpreters: PythonInterpreter[]) {
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const globalPersistence = persistentFactory.createGlobalPersistentState<PythonInterpreter[]>(this.name, []);
        globalPersistence.value = interpreters;
    }
}
